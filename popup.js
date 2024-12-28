document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const results = document.getElementById('results');
  const loadingIndicator = document.querySelector('.loading-indicator');
  const resultsContent = document.querySelector('.results-content');

  // Settings elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsDialog = document.getElementById('settingsDialog');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Settings form elements
  const modelType = document.getElementById('modelType');
  const endpoint = document.getElementById('endpoint');
  const endpointError = document.getElementById('endpointError');
  const apiKey = document.getElementById('apiKey');
  const apiVersion = document.getElementById('apiVersion');
  const deploymentName = document.getElementById('deploymentName');
  const deploymentLabel = document.getElementById('deploymentLabel');
  const modelHelp = document.getElementById('modelHelp');

  // Get parent form groups for conditional display
  const endpointGroup = endpoint.closest('.form-group');
  const apiVersionGroup = apiVersion.closest('.form-group');

  // Report status elements
  const reportStatus = document.getElementById('reportStatus');
  const noReportText = reportStatus.querySelector('.no-report');
  const hasReportText = reportStatus.querySelector('.has-report');
  const reportIdSpan = hasReportText.querySelector('.report-id');
  const reportNameSpan = hasReportText.querySelector('.report-name');
  const reportViewSpan = hasReportText.querySelector('.report-view');
  const mainFilter = hasReportText.querySelector('.main-filter');
  const moreFilters = hasReportText.querySelector('.more-filters');
  const leftProperty = hasReportText.querySelector('.left-property');
  const rightProperty = hasReportText.querySelector('.right-property');
  let currentReportId = null;

  // Function to update the UI based on report status
  function updateReportStatus(reportId) {
    currentReportId = reportId;
    if (reportId) {
      // Get all storage data to properly count edges
      chrome.storage.local.get(null, function(data) {
        if (data.reportInfo) {
          const info = data.reportInfo;
          
          // Update basic info
          reportIdSpan.textContent = info.id;
          reportNameSpan.textContent = info.name;
          reportViewSpan.textContent = info.view;
          
          // Get edge counts for each filter type
          const edgeCounts = {};
          Object.keys(data).forEach(key => {
            if (key.startsWith(`edges_${reportId}.`)) {
              const type = key.split('.')[1];
              edgeCounts[type] = data[key].length;
            }
          });
          
          // Update filters with edge counts
          if (info.mainFilter) {
            const mainFilterCount = edgeCounts[info.mainFilter] || 0;
            mainFilter.textContent = `${info.mainFilter} (${mainFilterCount})`;
          } else {
            mainFilter.textContent = 'None';
          }

          if (info.moreFilters.length > 0) {
            moreFilters.innerHTML = info.moreFilters
              .map(filter => {
                const count = edgeCounts[filter] || 0;
                return `<span>${filter} (${count})</span>`;
              })
              .join('');
          } else {
            moreFilters.textContent = 'None';
          }
          
          // Update properties
          leftProperty.textContent = info.properties.left || 'None';
          rightProperty.textContent = info.properties.right || 'None';

          // Show the report info
          noReportText.style.display = 'none';
          hasReportText.style.display = 'block';
          analyzeBtn.disabled = false;
        }
      });
    } else {
      noReportText.style.display = 'block';
      hasReportText.style.display = 'none';
      reportIdSpan.textContent = '';
      reportNameSpan.textContent = '';
      reportViewSpan.textContent = '';
      mainFilter.textContent = '';
      moreFilters.innerHTML = '';
      leftProperty.textContent = '';
      rightProperty.textContent = '';
      analyzeBtn.disabled = true;
    }
  }

  // Listen for report detection messages from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'reportDetected') {
      updateReportStatus(message.reportId);
    }
  });

  // Check initial report status when popup opens
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (!currentUrl.includes('leanix.net')) {
      analyzeBtn.disabled = true;
      resultsContent.innerHTML = '<p>Please open this extension while viewing a LeanIX report.</p>';
      results.style.display = 'block';
      return;
    }

    // Check if we have stored report info
    chrome.storage.local.get('reportInfo', function(data) {
      if (data.reportInfo) {
        // If we have stored info, verify the ID is in the current URL
        if (currentUrl.includes(data.reportInfo.id)) {
          updateReportStatus(data.reportInfo.id);
        } else {
          // Clear the stored info if it doesn't match current URL
          chrome.storage.local.remove('reportInfo');
          updateReportStatus(null);
        }
      } else {
        // If no stored info, check with content script
        chrome.tabs.sendMessage(tabs[0].id, { action: 'checkReport' }, function(response) {
          if (response && response.hasReport) {
            updateReportStatus(response.reportId);
          } else {
            updateReportStatus(null);
          }
        });
      }
    });
  });

  // Handle provider change
  function updateFormFields() {
    const isOpenAI = modelType.value === 'openai';
    endpointGroup.style.display = isOpenAI ? 'none' : 'block';
    apiVersionGroup.style.display = isOpenAI ? 'none' : 'block';

    // Update deployment/model name field
    if (isOpenAI) {
      deploymentLabel.textContent = 'Model Name';
      deploymentName.placeholder = 'Enter model name';
      modelHelp.textContent = 'e.g. gpt-4o-mini';
      modelHelp.style.display = 'block';
    } else {
      deploymentLabel.textContent = 'Deployment Name';
      deploymentName.placeholder = 'Enter deployment name';
      modelHelp.style.display = 'none';
    }

    // Clear hidden fields when switching to OpenAI
    if (isOpenAI) {
      endpoint.value = '';
      apiVersion.value = '';
    }
  }

  modelType.addEventListener('change', updateFormFields);

  // Load saved settings
  chrome.storage.sync.get([
    'modelType',
    'endpoint',
    'apiKey',
    'apiVersion',
    'deploymentName'
  ], function(data) {
    if (data.modelType) modelType.value = data.modelType;
    if (data.endpoint) endpoint.value = data.endpoint;
    if (data.apiKey) apiKey.value = data.apiKey;
    if (data.apiVersion) apiVersion.value = data.apiVersion;
    if (data.deploymentName) deploymentName.value = data.deploymentName;
    updateFormFields(); // Update field visibility based on loaded provider
  });

  // Endpoint validation
  endpoint.addEventListener('input', validateEndpoint);
  endpoint.addEventListener('blur', validateEndpoint);

  function validateEndpoint() {
    const value = endpoint.value.trim();
    const isValid = value === '' || value.startsWith('http://') || value.startsWith('https://');
    
    endpoint.classList.toggle('error', !isValid);
    endpointError.style.display = isValid ? 'none' : 'block';
    
    return isValid;
  }

  // Settings dialog handlers
  settingsBtn.addEventListener('click', () => {
    settingsDialog.style.display = 'flex';
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsDialog.style.display = 'none';
  });

  // Close dialog when clicking outside
  settingsDialog.addEventListener('click', (e) => {
    if (e.target === settingsDialog) {
      settingsDialog.style.display = 'none';
    }
  });

  // Tab handling
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked button and corresponding pane
      button.classList.add('active');
      document.getElementById(button.dataset.tab).classList.add('active');
    });
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    // Validate endpoint before saving
    if (modelType.value !== 'openai' && !validateEndpoint()) {
      return; // Don't save if endpoint is invalid (except for OpenAI)
    }

    const settings = {
      modelType: modelType.value,
      endpoint: endpoint.value.trim(),
      apiKey: apiKey.value,
      apiVersion: apiVersion.value,
      deploymentName: deploymentName.value
    };

    chrome.storage.sync.set(settings, function() {
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.textContent = 'Settings saved successfully!';
      successMessage.style.color = '#107e3e';
      successMessage.style.textAlign = 'center';
      successMessage.style.padding = '8px';
      
      const footer = document.querySelector('.dialog-footer');
      footer.insertBefore(successMessage, saveSettingsBtn);

      // Remove message after 2 seconds
      setTimeout(() => {
        successMessage.remove();
        settingsDialog.style.display = 'none';
      }, 2000);
    });
  });

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

  // Test connection functionality
  async function testConnection() {
    const footer = document.querySelector('.dialog-footer');
    const existingStatus = footer.querySelector('.connection-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Disable buttons during test
    testConnectionBtn.disabled = true;
    saveSettingsBtn.disabled = true;

    const statusDiv = document.createElement('div');
    statusDiv.className = 'connection-status';
    footer.insertBefore(statusDiv, saveSettingsBtn);

    try {
      // Common validation
      if (!apiKey.value) {
        throw new Error('API Key is required');
      }

      switch (modelType.value) {
        case 'openai':
          await testOpenAIConnection();
          break;
        case 'azure':
          await testAzureConnection();
          break;
        case 'genai':
          await testGenAIConnection();
          break;
      }
      
      // Success state
      statusDiv.className = 'connection-status success';
      statusDiv.innerHTML = '<i class="sap-icon">&#xe05b;</i> Connection successful';
    } catch (error) {
      // Error state
      statusDiv.className = 'connection-status error';
      statusDiv.innerHTML = `<i class="sap-icon">&#xe1ec;</i> ${error.message}`;
    } finally {
      // Re-enable buttons
      testConnectionBtn.disabled = false;
      saveSettingsBtn.disabled = false;

      // Remove status after 3 seconds
      setTimeout(() => {
        statusDiv.remove();
      }, 3000);
    }
  }

  async function testOpenAIConnection() {
    if (!deploymentName.value) {
      throw new Error('Model Name is required');
    }

    // Test OpenAI connection and model existence
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.value}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Invalid API key or connection failed');
      }

      const models = await response.json();
      const modelExists = models.data.some(model => 
        model.id.toLowerCase() === deploymentName.value.toLowerCase()
      );

      if (!modelExists) {
        throw new Error(`Model "${deploymentName.value}" not found`);
      }
    } catch (error) {
      if (error.message.includes('Model')) {
        throw error;
      }
      throw new Error('Failed to connect to OpenAI');
    }
  }

  async function testAzureConnection() {
    if (!endpoint.value) {
      throw new Error('Endpoint is required');
    }
    if (!apiVersion.value) {
      throw new Error('API Version is required');
    }
    if (!deploymentName.value) {
      throw new Error('Deployment Name is required');
    }

    // Validate endpoint format
    if (!endpoint.value.startsWith('http://') && !endpoint.value.startsWith('https://')) {
      throw new Error('Endpoint must start with http:// or https://');
    }

    // Test Azure OpenAI connection
    try {
      const testEndpoint = `${endpoint.value}/openai/deployments/${deploymentName.value}?api-version=${apiVersion.value}`;
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'api-key': apiKey.value,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Azure OpenAI');
      }
    } catch (error) {
      throw new Error('Failed to connect to Azure OpenAI. Please check your settings.');
    }
  }

  async function testGenAIConnection() {
    if (!endpoint.value) {
      throw new Error('Endpoint is required');
    }
    if (!apiVersion.value) {
      throw new Error('API Version is required');
    }
    if (!deploymentName.value) {
      throw new Error('Deployment Name is required');
    }

    // Validate endpoint format
    if (!endpoint.value.startsWith('http://') && !endpoint.value.startsWith('https://')) {
      throw new Error('Endpoint must start with http:// or https://');
    }

    // Test GenAI Hub connection
    try {
      const testEndpoint = `${endpoint.value}/api/v1/health`;
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.value}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to GenAI Hub');
      }
    } catch (error) {
      throw new Error('Failed to connect to GenAI Hub. Please check your settings.');
    }
  }

  testConnectionBtn.addEventListener('click', testConnection);
});
