# Felipe-Ribas_Testes

## rtk

[rtk](https://github.com/rtk-ai/rtk) is a CLI proxy that cuts down the tokens LLM coding agents use on shell command output.

### Install

```sh
brew install rtk                                              # macOS / Linux
winget install rtk-ai.rtk                                     # Windows
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

The `curl` script downloads a prebuilt binary from GitHub Releases, checks its SHA-256 checksum, and installs it to `~/.local/bin`. Set `RTK_VERSION=vX.Y.Z` to pin a version, or `RTK_EDITION=oss` for the Apache-2.0 edition.

### Build from source (when release downloads are blocked)

```sh
git clone --depth 1 https://github.com/rtk-ai/rtk
cargo install --path rtk --locked
```

Don't use `cargo install rtk`. The `rtk` crate on crates.io is a different project.

Check the install with `rtk --version`.
