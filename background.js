// Store the current report ID
let currentReportId = null;

// Track failed and processed requests
const failedRequests = new Set();
const processedRequests = new Set();

// Track GraphQL requests by bookmarkId and type
const graphqlRequests = new Map();

// Store edges by report ID and fact sheet type
const edgeCollections = new Map();

// Pattern for report URLs with markAsViewed=true
const reportUrlPattern = /\/services\/pathfinder\/v1\/bookmarks\/([a-f0-9-]+)\?.*markAsViewed=true/;
const graphqlPattern = /\/services\/impacts\/v1\/graphql.*bookmarkId=([a-f0-9-]+)/;

function extractFactSheetType(jsonBody) {
  // Check composite filter structure
  const compositeFilter = jsonBody.variables?.filter?.composite?.group?.elements;
  if (compositeFilter) {
    for (const element of compositeFilter) {
      const factSheetFilter = element.filter?.elements?.find(e => 
        e.facetKey === 'FactSheetTypes' && e.keys?.length > 0
      );
      if (factSheetFilter) {
        return factSheetFilter.keys[0];
      }
    }
  }

  // Check facetFilters structure
  const facetFilters = jsonBody.variables?.filter?.facetFilters;
  if (facetFilters) {
    const factSheetFilter = facetFilters.find(f => 
      f.facetKey === 'FactSheetTypes' && f.keys?.length > 0
    );
    if (factSheetFilter) {
      return factSheetFilter.keys[0];
    }
  }

  return null;
}

function mergeEdges(existingEdges, newEdges) {
  const edgeMap = new Map();
  
  // First, add all existing edges to the map
  existingEdges.forEach(edge => {
    if (edge.node && edge.node.id) {
      edgeMap.set(edge.node.id, edge);
    }
  });
  
  // Then merge in new edges, overwriting if the ID already exists
  newEdges.forEach(edge => {
    if (edge.node && edge.node.id) {
      edgeMap.set(edge.node.id, edge);
    }
  });
  
  // Convert back to array
  return Array.from(edgeMap.values());
}

// Debug helper function
function debugStorage() {
  chrome.storage.local.get(null, function(items) {
    console.log('Current chrome.storage.local contents:');
    console.log(JSON.stringify(items, null, 2));
  });
}

function clearStorage() { // only used for debugging
  chrome.storage.local.get(null, function(items) {
    // Get all keys that we manage (request_, auth_, edges_)
    const keysToRemove = Object.keys(items).filter(key => 
      key.startsWith('request_') || 
      key.startsWith('auth_') || 
      key.startsWith('edges_')
    );
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.log('Storage items cleared:', keysToRemove);
        // Also clear our in-memory tracking
        graphqlRequests.clear();
        edgeCollections.clear();
        processedRequests.clear();
        failedRequests.clear();
        currentReportId = null;
      });
    }
  });
}

function cleanupTempStorage() {
  chrome.storage.local.get(null, function(items) {
    // Get all keys that start with 'request_' or 'auth_'
    // but not 'edges_' which we want to preserve
    const keysToRemove = Object.keys(items).filter(key => 
      (key.startsWith('request_') || key.startsWith('auth_')) &&
      !key.startsWith('edges_')
    );
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.log('Temporary storage items cleared:', keysToRemove);
      });
    }
  });
}

// Listen for GraphQL requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const match = details.url.match(graphqlPattern);
    if (match && details.requestBody) {
      const bookmarkId = match[1];
      console.log("Intercepted GraphQL request for bookmarkId:", bookmarkId);
      
      try {
        // Get the request body from form data
        let bodyText;
        if (details.requestBody.raw) {
          const rawBody = details.requestBody.raw[0];
          bodyText = new TextDecoder().decode(rawBody.bytes);
        } else if (details.requestBody.formData) {
          bodyText = JSON.stringify(details.requestBody.formData);
        }
        
        if (!bodyText) return;
        
        const jsonBody = JSON.parse(bodyText);
        const factSheetType = extractFactSheetType(jsonBody);
        
        if (factSheetType) {
          if (!graphqlRequests.has(bookmarkId)) {
            graphqlRequests.set(bookmarkId, {
              total: 0,
              byType: new Map()
            });
          }
          
          const requestData = graphqlRequests.get(bookmarkId);
          requestData.total++;
          
          const typeCount = requestData.byType.get(factSheetType) || 0;
          requestData.byType.set(factSheetType, typeCount + 1);

          // Store the request body for later use
          chrome.storage.local.set({
            [`request_${bookmarkId}_${factSheetType}_${typeCount}`]: {
              url: details.url,
              body: bodyText
            }
          });
        }
      } catch (error) {
        console.error('Error parsing GraphQL request:', error);
      }
    }
  },
  {
    urls: ["*://*.leanix.net/services/impacts/v1/graphql*"]
  },
  ["requestBody"]
);

// Listen for headers to get auth token
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const match = details.url.match(graphqlPattern);
    if (match) {
      const bookmarkId = match[1];
      const authHeader = details.requestHeaders.find(header => 
        header.name.toLowerCase() === 'authorization'
      );

      if (authHeader) {
        // Store the auth header for this request
        chrome.storage.local.set({
          [`auth_${bookmarkId}`]: authHeader.value
        });
      }
    }
  },
  {
    urls: ["*://*.leanix.net/services/impacts/v1/graphql*"]
  },
  ["requestHeaders"]
);

// Listen for report requests
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    // Skip if this URL has already been processed or failed
    if (failedRequests.has(details.url) || processedRequests.has(details.url)) {
      console.log("Skipping already processed or failed request:", details.url);
      return;
    }

    // Check if URL matches our pattern with markAsViewed=true
    const match = details.url.match(reportUrlPattern);
    if (!match) {
      return;
    }

    const reportId = match[1];
    const requestData = graphqlRequests.get(reportId);
    console.log(`Intercepted report request for ID ${reportId}`);
    
    // Get the report data first
    const authHeader = details.requestHeaders.find(header => 
      header.name.toLowerCase() === 'authorization'
    );

    if (authHeader) {
      // Extract base URL from the details.url
      const baseUrl = details.url.match(/(https:\/\/.*?\.leanix\.net)/)[1];
      
      fetch(details.url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader.value
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data?.data) {
          // Extract and store the report information
          const allFilters = Object.keys(data.data.state?.filters || {})
            .map(filter => filter.replace('reporting.', ''));
            
          const reportInfo = {
            id: data.data.id,
            name: data.data.name,
            view: data.data.state?.customState?.view || '',
            filters: allFilters,
            mainFilter: allFilters[0] || '',
            moreFilters: allFilters.slice(1) || [],
            properties: {
              left: data.data.state?.customState?.properties?.left || '',
              right: data.data.state?.customState?.properties?.right || ''
            }
          };

          // Fetch meta model for the main filter
          if (reportInfo.mainFilter) {
            fetchMetaModel(baseUrl, authHeader.value, reportInfo.mainFilter)
              .then(metaModel => {
                // Get all relevant fields from the report settings
                const relevantFields = new Set([
                  reportInfo.view,
                  reportInfo.properties.left,
                  reportInfo.properties.right
                ].filter(field => field && field !== '')); // Remove empty/null values

                // Get translations for all relevant fields
                const fieldTranslations = {};
                for (const fieldKey of relevantFields) {
                  const translation = getTranslationOfField(metaModel, reportInfo.mainFilter, fieldKey);
                  if (translation) {
                    fieldTranslations[fieldKey] = translation;
                  }
                }
                
                reportInfo.fieldTranslations = fieldTranslations;
                
                // Store the updated report info
                chrome.storage.local.set({ reportInfo }, () => {
                  // Notify any open popups about the new report
                  chrome.runtime.sendMessage({
                    action: 'reportDetected',
                    reportId: reportInfo.id
                  });

                  // Now process the GraphQL requests if we have any
                  if (requestData) {
                    console.log(`Found ${requestData.total} related GraphQL requests`);
                    
                    console.log('Filters found in report:');
                    console.log(`- Main filter: ${reportInfo.mainFilter}`);
                    console.log(`- More filters: ${reportInfo.moreFilters.join(', ') || 'none'}`);
                    
                    // Log requests by filter type
                    const mainFilterCount = requestData.byType.get(reportInfo.mainFilter) || 0;
                    console.log(`\nGraphQL requests by filter type:`);
                    console.log(`- Main filter (${reportInfo.mainFilter}): ${mainFilterCount} requests`);
                    
                    reportInfo.moreFilters.forEach(filter => {
                      const filterCount = requestData.byType.get(filter) || 0;
                      console.log(`- More filter (${filter}): ${filterCount} requests`);
                    });

                    // Re-fetch all stored requests
                    const authToken = authHeader.value;
                    let completedRequests = 0;
                    const totalRequests = [...requestData.byType.entries()].reduce((sum, [_, count]) => sum + count, 0);

                    [...requestData.byType.entries()].forEach(([type, count]) => {
                      for (let i = 0; i < count; i++) {
                        const key = `request_${reportId}_${type}_${i}`;
                        chrome.storage.local.get(key, (requestData) => {
                          if (requestData[key]) {
                            const { url, body } = requestData[key];
                            console.log('Fetching GraphQL data from:', url);
                            fetch(url, {
                              method: 'POST',
                              headers: {
                                'Authorization': authToken,
                                'Content-Type': 'application/json'
                              },
                              body: body
                            })
                            .then(response => response.json())
                            .then(data => {
                              if (data?.data?.current?.edges) {
                                const collectionKey = `${reportId}.${type}`;
                                
                                // Get existing edges or initialize empty array
                                const existingEdges = edgeCollections.get(collectionKey) || [];
                                
                                // Merge new edges with existing ones
                                const mergedEdges = mergeEdges(existingEdges, data.data.current.edges);
                                edgeCollections.set(collectionKey, mergedEdges);
                                
                                console.log(`Updated edges for ${collectionKey} (${mergedEdges.length} unique nodes)`);
                                // console.log(mergedEdges); // keep for debugging

                                // Store the merged edges in chrome.storage.local
                                chrome.storage.local.set({
                                  [`edges_${collectionKey}`]: mergedEdges
                                }, () => {
                                  console.log(`Saved edges for ${collectionKey} to storage`);
                                  completedRequests++;
                                  
                                  // Only clean up after all requests are processed
                                  if (completedRequests === totalRequests) {
                                    console.log('All GraphQL requests processed, cleaning up temporary storage');
                                    // debugStorage(); // keep for debugging
                                    cleanupTempStorage();
                                  }
                                });
                              }
                            })
                            .catch(error => {
                              console.error('Error fetching GraphQL data:', error);
                              completedRequests++;
                              
                              // Even if there's an error, we should clean up if this was the last request
                              if (completedRequests === totalRequests) {
                                console.log('All GraphQL requests processed (with some errors), cleaning up temporary storage');
                                // debugStorage(); // keep for debugging
                                cleanupTempStorage();
                              }
                            });
                          }
                        });
                      }
                    });
                  } else {
                    console.log('No related GraphQL requests found');
                  }
                });
              })
              .catch(error => {
                console.error('Error processing meta model:', error);
              });
          }
        }
      })
      .catch(error => {
        console.error('Error fetching report data:', error);
        failedRequests.add(details.url);
      });
    }

    // Clear the GraphQL requests for this report
    graphqlRequests.delete(reportId);
    
    // Mark this URL as processed
    processedRequests.add(details.url);
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
        // Clear processed and failed requests when switching to a new report
        processedRequests.clear();
        failedRequests.clear();
      }
    }
  },
  {
    urls: ["*://*.leanix.net/services/pathfinder/v1/bookmarks/*"],
    types: ["xmlhttprequest"]
  }
);

// Add the new fetchMetaModel function before the last event listener
function fetchMetaModel(baseUrl, authToken, factSheetType) {
  const metaModelUrl = `${baseUrl}/services/pathfinder/v1/models/metaModel/${factSheetType}`;
  console.log(`Fetching meta model for ${factSheetType} from:`, metaModelUrl);
  
  return fetch(metaModelUrl, {
    method: 'GET',
    headers: {
      'Authorization': authToken
    }
  })
  .then(response => response.json())
  .catch(error => {
    console.error(`Error fetching meta model for ${factSheetType}:`, error);
    throw error;
  });
}

function getTranslationOfField(metaModel, factSheetType, fieldKey) {
  const factSheetTypeData = metaModel.data.factSheetTypes.find(type => type.key === factSheetType);
  
  if (!factSheetTypeData) {
    console.log(`No factSheet type found for ${factSheetType}`);
    return null;
  }

  // Search through all sections and their fields
  for (const section of factSheetTypeData.sections) {
    // If the section has fields, search through them
    if (section.fields) {
      const field = section.fields.find(field => field.key === fieldKey);
      if (field) {
        console.log(`Found field data for ${fieldKey}:`, field);
        return field;
      }
    }
    
    // If the section has subsections, search through their fields
    if (section.subsections) {
      for (const subsection of section.subsections) {
        if (subsection.fields) {
          const field = subsection.fields.find(field => field.key === fieldKey);
          if (field) {
            console.log(`Found field data for ${fieldKey} in subsection:`, field);

            fieldTranslation = field.translations.en
            if (!fieldTranslation) {
              console.log(`No en fieldTranslation found for ${fieldKey} in subsection:`, field);
              return null;
            }

            if (field.values.length > 0) {
              // Create translations for each value
              valueTranslations = field.values.reduce((acc, value) => {
                // Get the English translation for this value
                const translation = value.translations.en;
                if (translation) {
                  acc[value.key] = translation;
                }
                return acc;
              }, {});
            } else {
              valueTranslations = []
            }
            
            translationsObject = {
              "fieldTranslation": fieldTranslation,
              "valueTranslations": valueTranslations
            }

            return translationsObject
          }
        }
      }
    }
  }
  
  console.log(`No field found with key ${fieldKey}`);
  return null;
} 