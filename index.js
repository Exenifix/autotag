const core = require("@actions/core");
const github = require('@actions/github');

function generateNotes(commits) {
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
    return commits.map(e => `- ${e.id} ${e.message}`).join("\n") + "\n";
}

function getTag(arr) {
    return "v" + arr.join(".");
}

function anyCommitIncludes(commits, value) {
    return commits.some(el => el.message.toLowerCase().includes(value));
}

function getNextReleaseTag(previousTag, commits) {
    let tag = previousTag.replace("v", "").split(".");
    tag = tag.map(e => parseInt(e));
    while (tag.length < 3) {
        tag.push(0);
    }
    let isMajorRelease = anyCommitIncludes(commits, "[major]");
    if (isMajorRelease) {
        return getTag([tag[0] + 1, 0, 0]);
    }
    let isFeatureRelease = anyCommitIncludes(commits, "[feature]");
    if (isFeatureRelease) {
        return getTag([tag[0], tag[1] + 1, 0]);
    }
    tag[2]++;
    return getTag(tag);
}

async function main() {
    let token = core.getInput("GITHUB_TOKEN");
    if (token.length === 0) {
        core.setFailed("No token");
        return;
    }
    const octokit = github.getOctokit(token);

    let tag;
    let commits;
    try {
        let latestRelease = await octokit.request("GET /repos/{owner}/{repo}/releases/latest",
            {
                owner: github.context.repo.owner,
                repo: github.context.repo.repo
            }
        );
        commits = await octokit.request("GET /repos/{owner}/{repo}/commits", {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
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
        console.log("There were no releases published before, using tag v1.0.0");
        tag = "v1.0.0";
        commits = github.context.payload.commits;
    }
    await octokit.request("POST /repos/{owner}/{repo}/releases", {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        tag_name: tag,
        body: generateNotes(commits)
    });
    console.log(`Successfully published new release with tag ${tag}`);
}

main()
