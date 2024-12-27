// Store the current report ID
let currentReportId = null;

// Track failed and processed requests
const failedRequests = new Set();
const processedRequests = new Set();

// Pattern for report URLs with markAsViewed=true
const reportUrlPattern = /\/services\/pathfinder\/v1\/bookmarks\/([a-f0-9-]+)\?.*markAsViewed=true/;

// Listen for network requests
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // Skip if this URL has already been processed or failed
    if (failedRequests.has(details.url) || processedRequests.has(details.url)) {
      return;
    }

    // Check if URL matches our pattern with markAsViewed=true
    const match = details.url.match(reportUrlPattern);
    if (!match) {
      return;
    }

    console.log('Intercepted request:', details.url);

    // Mark this URL as processed
    processedRequests.add(details.url);

    const authHeader = details.requestHeaders.find(header => 
      header.name.toLowerCase() === 'authorization'
    );
    if (authHeader) {
      // Recreate the request with the captured auth header
      fetch(details.url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader.value
        }
      })
      .then(response => response.json())
      .then(data => {
        console.log('Fetch response:', data);
        if (data && data.data) {
          // Extract and process the required information
          const reportInfo = {
            id: data.data.id,
            name: data.data.name,
            view: data.data.state?.customState?.view || '',
            filters: Object.keys(data.data.state?.filters || {})
              .map(filter => filter.replace('reporting.', '')),
            properties: {
              left: data.data.state?.customState?.properties?.left || '',
              right: data.data.state?.customState?.properties?.right || ''
            }
          };
          
          // Store the data and notify any open popups
          chrome.storage.local.set({ reportInfo, currentReportId: reportInfo.id }, () => {
            chrome.runtime.sendMessage({
              action: 'reportDetected',
              reportId: reportInfo.id
            });
          });
        }
      })
      .catch(error => {
        console.error('Error recreating request:', error);
        failedRequests.add(details.url);
      });
    }
  },
  {
    urls: ["*://*.leanix.net/services/pathfinder/v1/bookmarks/*"]
  },
  ["requestHeaders"]
);

// Listen for completed requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const match = details.url.match(reportUrlPattern);
    if (match) {
      const reportId = match[1];
      if (reportId !== currentReportId) {
        currentReportId = reportId;
        chrome.storage.local.set({ currentReportId: reportId });
      }
    }
  },
  {
    urls: ["*://*.leanix.net/services/pathfinder/v1/bookmarks/*"],
    types: ["xmlhttprequest"]
  }
); 