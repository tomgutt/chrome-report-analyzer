# LeanIX Report Analyzer

<div align="center"><img src="images/icon128.png" alt="LeanIX Report Analyzer Icon" width="128" height="128" align="center"></div><br>

A Chrome extension that helps analyze LeanIX reports by detecting fact sheets and providing AI-powered insights.

## Features

- Automatically detects when a LeanIX report is opened
- Captures and processes GraphQL requests for fact sheet data
- Resolves UUIDs to human-readable names across different filters
- Marks relevant fact sheets in the report with interactive indicators
- Provides AI-powered analysis of the report data
- Caches analysis results for quick access across sessions and devices
- Configurable to work with different AI providers (OpenAI, Azure OpenAI, GenAI)
- Supports multiple output modes for different model types
- Allows additional user instructions for customized analysis

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Open a LeanIX report in your browser
2. Click the extension icon to open the popup
3. Configure your AI settings (first time only):
   - Select your AI provider (OpenAI, Azure OpenAI, or GenAI)
   - Enter your API credentials
   - Choose appropriate output mode for your model
   - Test the connection
   - Save your settings
4. Click "Analyze Report" to start the analysis
5. View the results and hover over the markers in the report for detailed insights
6. Previously analyzed reports will show cached results automatically

## Configuration

The extension supports three AI providers:

### OpenAI
- Model Name (e.g., gpt-4)
- API Key

### Azure OpenAI
- Endpoint URL
- API Version
- Deployment Name
- API Key

### GenAI
- Endpoint URL
- API Version
- Deployment Name
- API Key

### Output Modes
- JSON Output Mode (recommended for most models)
- JSON Output Schema (for o3-mini 2025-01-31+, o1 2024-12-17+, gpt-4o-mini 2024-07-18+, gpt-4o 2024-08-06+)
- Text Mode (for o1-preview and o1-mini)

## Features in Detail

### Report Detection
- Automatically detects when a LeanIX report is opened
- Monitors for URL changes to update report status
- Restores cached analysis results when returning to previously analyzed reports

### Data Processing
- Intercepts GraphQL requests for fact sheet data
- Merges multiple requests for comprehensive data collection
- Resolves UUIDs to human-readable names using cross-referencing

### Visual Indicators
- Adds pulsing icons next to relevant fact sheets in the report
- Shows detailed reasoning on hover
- Smart positioning of tooltips to ensure visibility

### AI Analysis
- Transforms data into a standardized format
- Generates insights based on report structure and content
- Provides reasoning for each highlighted fact sheet
- Supports different output modes for various model types
- Allows custom analysis instructions through optional user input

### Result Caching
- Automatically saves analysis results
- Syncs results across devices using Chrome sync storage
- Shows cached results immediately when returning to a report
- Allows re-analysis of reports when needed

## Current Limitations

- Only works with custom Landscape Reports (predefined reports are not supported)
- SAP GenAI Hub integration is in beta and not fully tested
- Extension is not extensively tested for bugs
- View and properties are not translated (technical values)

## Development

The extension consists of several key components:

- `manifest.json`: Extension configuration
- `popup.html/js`: User interface and control logic
- `content.js`: Page interaction and visual markers
- `background.js`: Request interception and data processing
- `prompt-template.js`: AI prompt templates and schema generation
- `styles.css`: UI styling with SAP Fiori design system
