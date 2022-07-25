const core = require("@actions/core");
const github = require('@actions/github');

const octokit = github.getOctokit(core.getInput("GITHUB_TOKEN"));

const tagRegex = /\[(?:major|patch|feature)]/g;
const issueRegex = /(clos|fix|resolv)(e|es|ed) #\d+/g;
const defaultParams = {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo
};

async function getIssue(issueId) {
    try {
        let response = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}",
            {
                ...defaultParams,
                issue_number: issueId
            });
        return response.data;
    } catch (RequestError) {
        return null;
    }
}

async function generateIssuesNotes(commits) {
    let s = "";
    let issues = [];
    for (let commit of commits) {
        let match = commit.message.match(issueRegex);
        if (match != null) {
            let issue = await getIssue(match[0].split(" ")[1].replace("#", ""));
            if (issue != null) {
                issues.push(issue);
            }
        }
    }
    let bugFixes = [];
    let featuresImplemented = [];
    let otherIssues = [];
    for (let issue of issues) {
        let labels = issue.labels;
        if (labels.includes("bug")) {
            bugFixes.push(issue);
        } else if (["enhancement", "suggestion", "feature"].some(e => labels.includes(e))) {
            featuresImplemented.push(issue);
        } else {
            otherIssues.push(issue);
        }
    }
    if (bugFixes.length > 0) {
        s += "## Bugfixes\n";
        s += issuesToString(bugFixes);
    }
    if (featuresImplemented.length > 0) {
        s += "## Features Implemented\n";
        s += issuesToString(featuresImplemented);
    }
    if (otherIssues.length > 0) {
        s += "## Issues Closed";
        s += issuesToString(otherIssues);
    }

    return s;
}

async function generateReleaseNotes(commits) {
    return await generateIssuesNotes(commits) + "\n" + generateCommitNotes(commits);
}

function generateCommitNotes(commits) {
    let majorCommits = [];
    let featureCommits = [];
    let patchCommits = [];
    let otherCommits = [];
    commits.forEach(commit => {
        if (commit.message.toLowerCase().includes("[major]")) {
            majorCommits.push(commit);
        } else if (commit.message.toLowerCase().includes("[feature]")) {
            featureCommits.push(commit);
        } else if (commit.message.toLowerCase().includes("[patch]")) {
            patchCommits.push(commit);
        } else {
            otherCommits.push(commit);
        }
    });
    let s = "";
    if (majorCommits.length > 0) {
        s += "## Major Changes\n";
        s += commitsToString(majorCommits);
    }
    if (featureCommits.length > 0) {
        s += "## Features\n";
        s += commitsToString(featureCommits);
    }
    if (patchCommits.length > 0) {
        s += "## Patches\n";
        s += commitsToString(patchCommits);
    }
    if (otherCommits.length > 0) {
        s += "## Other Changes\n";
        s += commitsToString(otherCommits);
    }
    return s;
}

function commitsToString(commits) {
    return commits.map(e => `- ${e.id} ${e.message.replace(tagRegex, "")}`).join("\n") + "\n";
}

function issuesToString(issues) {
    return issues.map(e => `- ${e.number} - ${e.title}`).join("\n") + "\n";
}

function getTag(arr) {
    return "v" + arr.join(".");
}

function anyCommitIncludes(commits, value) {
    return commits.some(el => el.message.toLowerCase().includes(value));
}

function getNextReleaseTag(previousTag, commits) {
    let tag = previousTag.replace("v", "").split(".");
    tag = tag.map(e => parseInt(e, 10));
    while (tag.length < 3) {
        tag.push(0);
    }
    let isMajorRelease = anyCommitIncludes(commits, "[major]");
    if (isMajorRelease) {
        return getTag([tag[0] + 1, 0]);
    }
    let isFeatureRelease = anyCommitIncludes(commits, "[feature]");
    if (isFeatureRelease) {
        return getTag([tag[0], tag[1] + 1]);
    }
    tag[2]++;
    return getTag(tag);
}

async function main() {
    let tag;
    let commits;
    try {
        let latestRelease = await octokit.request("GET /repos/{owner}/{repo}/releases/latest",
            defaultParams
        );
        commits = await octokit.request("GET /repos/{owner}/{repo}/commits", {
            ...defaultParams,
            since: latestRelease.data.published_at
        });
        commits = commits.data.map(e => {
            return {
                id: e.sha,
                message: e.commit.message
            }
        });
        tag = getNextReleaseTag(latestRelease.data.tag_name, commits);
    } catch (RequestError) {
        console.warn("There were no releases published before, using tag v1.0.0");
        tag = "v1.0.0";
        commits = github.context.payload.commits;
    }
    await octokit.request("POST /repos/{owner}/{repo}/releases", {
        ...defaultParams,
        tag_name: tag,
        body: await generateReleaseNotes(commits)
    });
    console.log(`Successfully published new release with tag ${tag}`);
}

main()
