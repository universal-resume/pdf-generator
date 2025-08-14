# Universal Resume PDF Generator

A command-line tool for generating beautiful PDF resumes from JSON data using customizable templates and themes.

This CLI tool is built on top of the [Universal Resume HTML Renderer](https://github.com/universal-resume/html-renderer) package, which provides the core rendering engine and template system for converting JSON Resume data into styled HTML.

## Getting Started

1. **Clone the repository:**
```bash
git clone <repository-url>
cd pdf-generator
```

2. **Install dependencies:**
```bash
npm ci
```

3. **Add your JSON resume:**
   - Place your JSON resume file in the `json/` directory
   - The file should follow the JSON Resume schema format

4. **Generate your PDF:**
```bash
npx pdf-generator
```

## Options

- `--resume <choice>` (`-r`) - JSON resume file from the json/ directory
- `--template <choice>` (`-t`) - Template to use (available: chronology, another)
- `--primary <choice>` (`-p`) - Primary color
- `--secondary <choice>` (`-s`) - Secondary color
- `--output <text>` (`-o`) - Output PDF filename
- `--force <boolean>` (`-f`) - Override any existing pdf

Example with options:
```bash
npx pdf-generator --resume bill-palmer.json --template chronology --primary blue --secondary sky --output resume.pdf --force
```

## License

[MIT](LICENSE)
