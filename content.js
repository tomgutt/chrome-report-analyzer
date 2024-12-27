// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeReport') {
    // Get the current report content
    const reportContent = extractReportContent();
    sendResponse({ content: reportContent });
  } else if (request.action === 'checkReport') {
    checkForReport().then(reportInfo => {
      sendResponse(reportInfo);
    });
    return true; // Required for async response
  }
});

// Pattern for report URLs
const reportUrlPattern = /\/services\/pathfinder\/v1\/bookmarks\/([a-f0-9-]+)\?/;

// Check for report on page load and URL changes
async function checkForReport() {
  // First check storage for any known report ID from network requests
  const storage = await chrome.storage.local.get('currentReportId');
  const storedReportId = storage.currentReportId;

  // Check if the report ID is in the current URL
  const currentUrl = window.location.href;
  const urlMatch = currentUrl.includes(storedReportId);

  if (storedReportId && urlMatch) {
    return {
      hasReport: true,
      reportId: storedReportId
    };
  }

  // If conditions aren't met, clear the stored report ID
  if (storedReportId && !urlMatch) {
    chrome.storage.local.remove('currentReportId');
  }

  return {
    hasReport: false,
    reportId: null
  };
}

// Check for report immediately when script loads
checkForReport().then(reportInfo => {
  if (reportInfo.hasReport) {
    chrome.runtime.sendMessage({
      action: 'reportDetected',
      reportId: reportInfo.reportId
    });
  }
});

// Listen for URL changes
let lastUrl = window.location.href;
new MutationObserver(() => {
  const url = window.location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    checkForReport().then(reportInfo => {
      if (reportInfo.hasReport) {
        chrome.runtime.sendMessage({
          action: 'reportDetected',
          reportId: reportInfo.reportId
        });
      }
    });
  }
}).observe(document, { subtree: true, childList: true });

function extractReportContent() {
  // Extract relevant information from the LeanIX report
  const reportData = {
    title: document.title,
    content: [],
    metadata: {}
  };

  // Get report content (adjust selectors based on LeanIX's DOM structure)
  const reportElements = document.querySelectorAll('.report-content, .fact-sheet-content');
  reportElements.forEach(element => {
    reportData.content.push(element.textContent);
  });

  // Get metadata if available
  const metadataElements = document.querySelectorAll('.metadata-field');
  metadataElements.forEach(element => {
    const key = element.getAttribute('data-field-name');
    const value = element.textContent;
    if (key && value) {
      reportData.metadata[key] = value;
    }
  });

  return reportData;
}
