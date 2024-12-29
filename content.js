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
  } else if (request.action === 'markFactSheets') {
    markFactSheetsInReport(request.factSheets);
    sendResponse({ status: 'ok' });
    return;
  }
});

// Pattern for report URLs
const reportUrlPattern = /\/services\/pathfinder\/v1\/bookmarks\/([a-f0-9-]+)\?/;

// Debug helper function
function debugStorage() {
  chrome.storage.local.get(null, function(items) {
    console.log('Current chrome.storage.local contents:');
    console.log(JSON.stringify(items, null, 2));
  });
}

// Check for report on page load and URL changes
async function checkForReport() {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.log('Extension context invalidated - reloading page to restore functionality');
    window.location.reload();
    return { hasReport: false, reportId: null };
  }

  // Check storage for report info
  let reportInfo;
  try {
    const storage = await chrome.storage.local.get('reportInfo');
    reportInfo = storage.reportInfo;
  } catch (error) {
    console.error('Error getting report info:', error);
    debugStorage();
    reportInfo = null;
  }

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
    try {
      await chrome.storage.local.remove('reportInfo');
    } catch (error) {
      console.error('Error removing report info:', error);
    }
  }

  return {
    hasReport: false,
    reportId: null
  };
}

// Check for report immediately when script loads
checkForReport().then(reportInfo => {
  if (reportInfo.hasReport) {
    try {
      chrome.runtime.sendMessage({
        action: 'reportDetected',
        reportId: reportInfo.reportId
      });
    } catch (error) {
      console.error('Error sending report detection message:', error);
    }
  }
});

// Listen for URL changes
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const url = window.location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated - disconnecting observer');
      observer.disconnect();
      window.location.reload();
      return;
    }
    
    checkForReport().then(reportInfo => {
      if (reportInfo.hasReport) {
        try {
          chrome.runtime.sendMessage({
            action: 'reportDetected',
            reportId: reportInfo.reportId
          });
        } catch (error) {
          console.error('Error sending report detection message:', error);
        }
      }
    });
  }
});

function markFactSheetsInReport(factSheets) {
  console.log(`Starting to mark ${factSheets.length} fact sheets in report:`, factSheets);
  
  // Add animation styles if not already present
  if (!document.querySelector('#fact-sheet-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'fact-sheet-styles';
    styleSheet.textContent = `
      @keyframes pulse {
        0% {
          transform: translateY(-50%) scale(1);
        }
        50% {
          transform: translateY(-50%) scale(1.2);
        }
        100% {
          transform: translateY(-50%) scale(1);
        }
      }
      
      .fact-sheet-marker {
        animation: pulse 2s infinite;
      }
    `;
    document.head.appendChild(styleSheet);
  }
  
  // Look for the report structure
  const reportDiv = document.querySelector('div#report');
  if (!reportDiv) {
    console.warn('Report div not found!');
    return;
  }
  console.log('Found report div:', reportDiv);

  // Remove any existing markers
  const existingMarkers = document.querySelectorAll('.fact-sheet-marker');
  console.log('Removing existing markers:', existingMarkers.length);
  existingMarkers.forEach(el => el.remove());
  
  const existingDialogs = document.querySelectorAll('.fact-sheet-dialog');
  console.log('Removing existing dialogs:', existingDialogs.length);
  existingDialogs.forEach(el => el.remove());

  // Create a map for quick lookup
  const factSheetMap = new Map(
    factSheets.map(fs => [fs.name || fs.id, fs])
  );
  console.log('Created fact sheet map with entries:', Array.from(factSheetMap.keys()));

  // Find and mark matching divs - looking in the item divs
  const items = reportDiv.querySelectorAll('.itemWrapper');
  console.log(`Found ${items.length} item wrappers to search through`);
  
  // Keep track of found fact sheets
  const foundFactSheets = new Set();
  
  // Continue searching through all items
  items.forEach((wrapperDiv) => {
    const ariaLabel = wrapperDiv.getAttribute('aria-label');
    const factSheet = factSheetMap.get(ariaLabel);
    
    if (ariaLabel && factSheet) {
      console.log(`Found matching fact sheet: ${ariaLabel}`);
      
      // Create marker icon
      const marker = document.createElement('i');
      marker.className = 'icon fa fa-sparkles ng-star-inserted fact-sheet-marker';
      marker.style.cssText = `
        cursor: pointer;
        margin-left: 4px;
        color: rgb(119, 79, 204);
        font-size: 24px;
        position: relative;
        float: right;
        top: 0%;
        transform: translateY(-50%);
        animation: pulse 1.5s infinite;
      `;
      
      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = 'fact-sheet-dialog';
      dialog.style.cssText = `
        display: none;
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        max-width: 300px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        z-index: 9999;
      `;
      dialog.textContent = factSheet.reason;
      
      // Add hover handlers with smart positioning
      marker.addEventListener('mouseenter', (e) => {
        const rect = marker.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        // Calculate left position to keep dialog visible
        let leftPos = rect.left + window.scrollX - 150; // Default center alignment
        if (leftPos < 10) {
          leftPos = 10; // Prevent going off left edge
        } else if (leftPos + 300 > viewportWidth - 10) {
          leftPos = viewportWidth - 310; // Prevent going off right edge
        }
        
        dialog.style.top = `${rect.bottom + window.scrollY + 5}px`;
        dialog.style.left = `${leftPos}px`;
        dialog.style.display = 'block';
      });
      
      marker.addEventListener('mouseleave', (e) => {
        // Small delay to check if cursor moved to dialog
        setTimeout(() => {
          const dialogRect = dialog.getBoundingClientRect();
          const mouseX = e.clientX;
          const mouseY = e.clientY;
          
          // If mouse is not over dialog, hide it
          if (mouseX < dialogRect.left || mouseX > dialogRect.right ||
              mouseY < dialogRect.top || mouseY > dialogRect.bottom) {
            dialog.style.display = 'none';
          }
        }, 100);
      });
      
      // Add hover handlers for dialog
      dialog.addEventListener('mouseenter', () => {
        dialog.style.display = 'block';
      });
      
      dialog.addEventListener('mouseleave', () => {
        dialog.style.display = 'none';
      });
      
      // Add elements to DOM - marker to item div, dialog to body
      const itemDiv = wrapperDiv.querySelector('.item');
      if (itemDiv) {
        itemDiv.appendChild(marker);
        document.body.appendChild(dialog);
      }
      
      foundFactSheets.add(ariaLabel);
    }
  });
  
  console.log(`Finished marking fact sheets. Found ${foundFactSheets.size} instances:`, Array.from(foundFactSheets));
}
