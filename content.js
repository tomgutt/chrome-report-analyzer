// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeReport') {
    // Get the current report content
    const reportContent = extractReportContent();
    sendResponse({ content: reportContent });
  }
});

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
