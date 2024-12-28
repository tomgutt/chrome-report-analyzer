// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
  } else if (request.action === 'analyzeReport') {
    // Get the current report info from storage
    chrome.storage.local.get('reportInfo', function(data) {
      sendResponse({ reportInfo: data.reportInfo });
    });
    return true; // Required for async response
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
  // Check storage for report info
  const storage = await chrome.storage.local.get('reportInfo');
  const reportInfo = storage.reportInfo;

  // Check if the report ID is in the current URL
  const currentUrl = window.location.href;
  const urlMatch = reportInfo && currentUrl.includes(reportInfo.id);

  if (reportInfo && urlMatch) {
    return {
      hasReport: true,
      reportId: reportInfo.id
    };
  }

  // If conditions aren't met, clear the stored report info
  if (reportInfo && !urlMatch) {
    chrome.storage.local.remove('reportInfo');
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
