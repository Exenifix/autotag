# AutoTag
JavaScript GitHub workflow for automatically tagging releases and creating release notes.

## Usage
### Adding to workflow
Include it into your workflow file
```yaml
...
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Publish New Release
-       uses: Exenifix/autotag@v1.0
```

### Writing commits
The workflow is able to split commits into several categories. It splits them based on certain `[tag]` included in message. Here's the table of categories and corresponding message tags:
| Category | Tag |
| :-------- | :---: |
| Major change | `[major]` |
| Feature | `[feature]` |
| Patch | `[patch]` |

All untagged commits belong to **Other commits** category.
