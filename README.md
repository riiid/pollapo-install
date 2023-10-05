# Pollapo Install

Github action workflow for pollapo install

## Getting Started

```yaml
# .github/workflows/my-workflow.yml
# ...
- name: Pollapo Install
  uses: riiid/pollapo-install@v2
  with:
    token: ${{ secrets.GITHUB_OAUTH_TOKEN }}  # required
    out-dir: .pollapo  # optional
    config: pollapo.yml  # optional
    working-directory: .  # optional
    env: ubuntu  # optional (ubuntu[default] / macOs)
# ...
```

