// Store the current report ID
let currentReportId = null;

// Pattern for report URLs
const reportUrlPattern = /\/services\/pathfinder\/v1\/bookmarks\/([a-f0-9-]+)\?/;

// Listen for network requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    console.log('Request intercepted:', details.url); // Debug log
    const match = details.url.match(reportUrlPattern);
    if (match) {
      const reportId = match[1];
      console.log('Report ID found:', reportId); // Debug log
      if (reportId !== currentReportId) {
        currentReportId = reportId;
        // Store the report ID
        chrome.storage.local.set({ currentReportId: reportId }, () => {
          console.log('Report ID stored:', reportId); // Debug log
        });
      }
    }
  },
  {
    urls: ["*://*.leanix.net/services/pathfinder/v1/bookmarks/*"],
    types: ["xmlhttprequest"]
  }
); 