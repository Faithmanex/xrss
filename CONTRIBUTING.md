# Contributing

Thanks for wanting to help.

## Ground rules

- Keep dependencies at zero. The point of this project is that it runs on bare Node.
- Every parser change needs a test with a realistic fixture. X changes its payload shape; fixtures are how we notice.
- Don't add features that require login, cookies, or paid API keys.

## Development

```bash
git clone https://github.com/Faithmanex/xrss.git
cd xrss
npm test
npm start
```

Node 20 or newer.

## Reporting a broken parser

X silently reshapes its embedded payload every few weeks. If feeds come back empty:

1. Run `node src/cli.js somehandle --json` and capture the error.
2. Save the profile HTML: `curl -s https://x.com/somehandle -o page.html`
3. Open an issue with the error and the HTML attached (redact anything you don't want public).

## Pull requests

- One concern per PR.
- Include tests.
- Update README if the public API changes.

## License

By contributing you agree your work is released under the MIT license.
