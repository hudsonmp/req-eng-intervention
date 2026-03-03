# LaTeX Compiler for Paperwork Page

## Overview

The `/paperwork` route now includes a LaTeX compiler that allows users to upload `.tex` files and view the compiled document directly in the browser.

## Features

- Upload `.tex` files through a file input button
- Real-time LaTeX compilation using `latex.js`
- Display compiled LaTeX documents in HTML format
- Error handling for invalid files or compilation errors
- Clean, professional styling for compiled documents

## Usage

1. Navigate to `http://localhost:3000/paperwork` (after logging in)
2. Click the "Upload .tex File" button
3. Select a `.tex` file from your computer
4. The document will automatically compile and display in the window

## Testing

A sample LaTeX file has been provided at:
```
/Users/hudsonmitchell-pullman/req-eng-intervention/system/frontend/sample-consent.tex
```

You can use this file to test the LaTeX compilation functionality.

## Technical Details

### Dependencies
- `latex.js` (v0.12.6) - JavaScript LaTeX to HTML converter

### Implementation
The PaperworkPage component includes:
- File upload handling with validation
- Asynchronous LaTeX compilation
- DOM manipulation to display compiled content
- Error handling and user feedback
- Responsive styling

### Files Modified
- `/Users/hudsonmitchell-pullman/req-eng-intervention/system/frontend/src/App.tsx` - Added PaperworkPage component with LaTeX compilation
- `/Users/hudsonmitchell-pullman/req-eng-intervention/system/frontend/src/App.css` - Added LaTeX document styling
- `/Users/hudsonmitchell-pullman/req-eng-intervention/system/frontend/package.json` - Added latex.js dependency

## Supported LaTeX Features

The `latex.js` library supports most common LaTeX commands including:
- Document structure (sections, subsections)
- Lists (itemize, enumerate)
- Text formatting (bold, italic, underline)
- Mathematical equations (basic support)
- Tables
- Custom spacing and layout commands

## Limitations

- Complex LaTeX packages may not be fully supported
- Some advanced mathematical features may have limited support
- Large documents may take a few seconds to compile
