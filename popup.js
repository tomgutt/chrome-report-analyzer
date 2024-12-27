document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const results = document.getElementById('results');
  const loadingIndicator = document.querySelector('.loading-indicator');
  const resultsContent = document.querySelector('.results-content');

  // Check if we're on a LeanIX page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (!currentUrl.includes('leanix.net')) {
      analyzeBtn.disabled = true;
      resultsContent.innerHTML = '<p>Please open this extension while viewing a LeanIX report.</p>';
      results.style.display = 'block';
      return;
    }
  });

  analyzeBtn.addEventListener('click', async function() {
    // Show loading state
    analyzeBtn.disabled = true;
    results.style.display = 'block';
    loadingIndicator.style.display = 'block';
    resultsContent.innerHTML = '';

    try {
      // Get the current tab
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Send message to content script to get report content
      const response = await chrome.tabs.sendMessage(tab.id, {action: 'analyzeReport'});
      
      // Here you would typically send the response.content to your AI service
      // For now, we'll simulate an analysis response
      await simulateAIAnalysis(response.content);
      
      // Display results
      displayResults([
        {
          title: 'Application XYZ',
          type: 'Application',
          relevance: 0.95,
          reason: 'This application is directly mentioned in the report and appears to be a key system in the discussed process.'
        },
        {
          title: 'Customer Data Service',
          type: 'Interface',
          relevance: 0.85,
          reason: 'The report discusses data flow patterns that heavily involve this service.'
        }
      ]);
    } catch (error) {
      resultsContent.innerHTML = `
        <div class="fact-sheet">
          <p class="error">Error analyzing the report. Please try again or make sure you're viewing a LeanIX report.</p>
        </div>
      `;
    } finally {
      loadingIndicator.style.display = 'none';
      analyzeBtn.disabled = false;
    }
  });

  function displayResults(factSheets) {
    let html = '<h3>Relevant Fact Sheets</h3>';
    
    factSheets.forEach(sheet => {
      html += `
        <div class="fact-sheet">
          <h3>${sheet.title}</h3>
          <p><strong>Type:</strong> ${sheet.type}</p>
          <p><strong>Relevance:</strong> ${(sheet.relevance * 100).toFixed(0)}%</p>
          <p><strong>Why relevant:</strong> ${sheet.reason}</p>
        </div>
      `;
    });

    resultsContent.innerHTML = html;
  }

  // Simulate AI analysis delay
  function simulateAIAnalysis() {
    return new Promise(resolve => setTimeout(resolve, 2000));
  }
});
