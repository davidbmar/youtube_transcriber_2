document.addEventListener('DOMContentLoaded', function() {
    // Constants and configurations
    const SEGMENTS_PER_PAGE = 20;
    const CONFIDENCE_THRESHOLDS = {
        HIGH: 0.8,
        MEDIUM: 0.6
    };
    
    // Global variables
    let transcriptData = null;
    let currentPage = 1;
    let totalPages = 1;
    let searchResults = [];
    let currentSearchIndex = -1;
    let videoListData = null;
    let currentVideoId = null;
    let youtubePlayer = null;
    let isPlayerReady = false;
    let autoScroll = true;
    let activeSegmentIndex = -1;
    
    // DOM Elements
    const configBtn = document.getElementById('config-btn');
    const s3BucketInput = document.getElementById('s3-bucket');
    const s3RegionInput = document.getElementById('s3-region');
    const videoSelect = document.getElementById('video-select');
    const videoTitle = document.getElementById('video-title');
    const transcriptElem = document.getElementById('transcript');
    const contentWrapper = document.getElementById('content-wrapper');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const searchTextInput = document.getElementById('search-text');
    const searchBtn = document.getElementById('search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const segmentCount = document.getElementById('segment-count');
    const wordCount = document.getElementById('word-count');
    const durationElem = document.getElementById('duration');
    const timeline = document.getElementById('timeline');
    const timelineProgress = document.getElementById('timeline-progress');
    const timelineMarker = document.getElementById('timeline-marker');
    const timelineSegments = document.getElementById('timeline-segments');
    const prevResultBtn = document.getElementById('prev-result');
    const nextResultBtn = document.getElementById('next-result');
    const searchNavElem = document.getElementById('search-nav');
    const searchPageInfo = document.getElementById('search-page-info');
    const columnLeft = document.getElementById('column-left');
    const columnRight = document.getElementById('column-right');
    
    // Set up panel move controls
    setupPanelControls();
    
    // Initialize YouTube API
    let tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    let firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    // Event listeners
    prevResultBtn.addEventListener('click', () => {
        if (currentSearchIndex > 0) {
            jumpToSearchResult(currentSearchIndex - 1);
        }
    });
    
    nextResultBtn.addEventListener('click', () => {
        if (currentSearchIndex < searchResults.length - 1) {
            jumpToSearchResult(currentSearchIndex + 1);
        }
    });
    
    configBtn.addEventListener('click', loadVideoList);
    
    // Handle video selection
    videoSelect.addEventListener('change', function() {
        const videoId = this.value;
        if (videoId) {
            loadTranscript(videoId);
        }
    });
    
    // Timeline click events
    timeline.addEventListener('click', function(event) {
        if (!transcriptData || !youtubePlayer || !isPlayerReady) return;
        
        const rect = timeline.getBoundingClientRect();
        const clickPos = (event.clientX - rect.left) / rect.width;
        
        const lastSegment = transcriptData.segments[transcriptData.segments.length - 1];
        const totalDuration = lastSegment.end;
        const seekTime = clickPos * totalDuration;
        
        seekToTime(seekTime);
    });
    
    // Search functionality
    searchBtn.addEventListener('click', searchTranscript);
    clearSearchBtn.addEventListener('click', clearSearch);
    searchTextInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchTranscript();
        }
    });
    
    // Pagination
    prevPageBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderTranscript();
        }
    });
    
    nextPageBtn.addEventListener('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            renderTranscript();
        }
    });
    
    // Try to load videos automatically
    loadVideoList();
    
    // Function called when YouTube API is ready
    window.onYouTubeIframeAPIReady = function() {
        console.log("YouTube API ready");
    };
    
    // Set up panel move controls
    function setupPanelControls() {
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const direction = this.classList.contains('move-left') ? 'left' : 'right';
                const panelId = this.getAttribute('data-panel');
                movePanel(panelId, direction);
            });
        });
    }
    
    // Move panel between columns
    function movePanel(panelId, direction) {
        const panel = document.getElementById(`panel-${panelId}`);
        if (!panel) return;
        
        // Get current parent and target parent
        const currentParent = panel.parentElement;
        const targetParent = direction === 'left' ? columnLeft : columnRight;
        
        // Don't move if already in target column
        if (currentParent === targetParent) return;
        
        // Move the panel
        targetParent.appendChild(panel);
        
        // Update move buttons
        updatePanelControls(panel, direction);
    }
    
    // Update panel control buttons after moving
    function updatePanelControls(panel, direction) {
        // Find control buttons in this panel
        const leftBtn = panel.querySelector('.move-btn.move-left');
        const rightBtn = panel.querySelector('.move-btn.move-right');
        
        // Show/hide appropriate buttons based on current column
        if (direction === 'left') {
            // Panel is now in left column, show right button, hide left button
            if (leftBtn) leftBtn.classList.add('hidden');
            if (rightBtn) rightBtn.classList.remove('hidden');
            
            // If no right button exists, create one
            if (!rightBtn) {
                createMoveButton(panel, 'right');
            }
        } else {
            // Panel is now in right column, show left button, hide right button
            if (rightBtn) rightBtn.classList.add('hidden');
            if (leftBtn) leftBtn.classList.remove('hidden');
            
            // If no left button exists, create one
            if (!leftBtn) {
                createMoveButton(panel, 'left');
            }
        }
    }
    
    // Create a new move button for a panel
    function createMoveButton(panel, direction) {
        const panelId = panel.getAttribute('data-panel-id');
        const panelControls = panel.querySelector('.panel-controls');
        
        if (!panelControls || !panelId) return;
        
        const newBtn = document.createElement('button');
        newBtn.className = `move-btn move-${direction}`;
        newBtn.setAttribute('data-panel', panelId);
        newBtn.setAttribute('title', `Move to ${direction} column`);
        
        // Set button icon based on direction
        if (direction === 'left') {
            newBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6"/>
                </svg>
            `;
        } else {
            newBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            `;
        }
        
        // Add click event
        newBtn.addEventListener('click', function() {
            movePanel(panelId, direction);
        });
        
        panelControls.appendChild(newBtn);
    }
    
    function loadVideoList() {
        const bucketName = s3BucketInput.value.trim();
        const region = s3RegionInput.value.trim();
        
        if (!bucketName) {
            showError("Please enter S3 bucket name");
            return;
        }
        
        resetUI();
        showLoader(true);
        
        // Configure S3 for public access
        AWS.config.region = region;
        AWS.config.credentials = new AWS.Credentials('dummy', 'dummy'); // Using dummy credentials
        
        const s3 = new AWS.S3({
            signatureVersion: 'v4',
            s3ForcePathStyle: true, // Use path-style URLs
            endpoint: `https://${bucketName}.s3.${region}.amazonaws.com`,
            params: { Bucket: bucketName }
        });
        
        // Function to get S3 object
        function getS3Object(key) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
                
                xhr.open('GET', url, true);
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`Failed to load ${url}: ${xhr.status} ${xhr.statusText}`));
                    }
                };
                xhr.onerror = function() {
                    reject(new Error(`Network error when loading ${url}`));
                };
                xhr.send();
            });
        }
        
        // Try to get the video list
        const videoListKey = "youtube_transcriber_2.json";
        
        getS3Object(videoListKey)
            .then(data => {
                try {
                    videoListData = JSON.parse(data);
                    populateVideoDropdown(videoListData);
                    showLoader(false);
                } catch (parseErr) {
                    showError("Error parsing video list data: " + parseErr.message);
                }
            })
            .catch(err => {
                showError("Error loading video list: " + err.message);
            });
    }
    


function loadVideoList() {
        const bucketName = s3BucketInput.value.trim();
        const region = s3RegionInput.value.trim();
        
        if (!bucketName) {
            showError("Please enter S3 bucket name");
            return;
        }
        
        resetUI();
        showLoader(true);
        
        // Configure S3 for public access
        AWS.config.region = region;
        AWS.config.credentials = new AWS.Credentials('dummy', 'dummy'); // Using dummy credentials
        
        const s3 = new AWS.S3({
            signatureVersion: 'v4',
            s3ForcePathStyle: true, // Use path-style URLs
            endpoint: `https://${bucketName}.s3.${region}.amazonaws.com`,
            params: { Bucket: bucketName }
        });
        
        // Function to get S3 object
        function getS3Object(key) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
                
                xhr.open('GET', url, true);
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`Failed to load ${url}: ${xhr.status} ${xhr.statusText}`));
                    }
                };
                xhr.onerror = function() {
                    reject(new Error(`Network error when loading ${url}`));
                };
                xhr.send();
            });
        }
        
        // Try to get the video list
        const videoListKey = "youtube_transcriber_2.json";
        
        getS3Object(videoListKey)
            .then(data => {
                try {
                    videoListData = JSON.parse(data);
                    populateVideoDropdown(videoListData);
                    showLoader(false);
                } catch (parseErr) {
                    showError("Error parsing video list data: " + parseErr.message);
                }
            })
            .catch(err => {
                showError("Error loading video list: " + err.message);
            });
    }
    
    function populateVideoDropdown(data) {
        if (!data.videos || data.videos.length === 0) {
            showError("No videos found in the video list");
            return;
        }
        
        // Clear existing options
        videoSelect.innerHTML = '<option value="">Select a video...</option>';
        
        // Add videos to dropdown
        data.videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video.id;
            option.textContent = video.title || `Video ${video.id}`;
            option.dataset.thumbnail = video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
            videoSelect.appendChild(option);
        });
        
        // Enable the dropdown
        videoSelect.disabled = false;
        
        // If there's at least one video, select it and load it
        if (data.videos.length > 0) {
            videoSelect.selectedIndex = 1; // First video after the placeholder
            const firstVideoId = data.videos[0].id;
            // Set timeout to ensure UI updates first
            setTimeout(() => loadTranscript(firstVideoId), 0);
        }
    }
    
    function loadTranscript(videoId) {
        const bucketName = s3BucketInput.value.trim();
        const region = s3RegionInput.value.trim();
        
        if (!bucketName || !videoId) {
            showError("Please enter both S3 bucket name and select a video");
            return;
        }
        
        // Store current video ID
        currentVideoId = videoId;
        
        resetUI(false); // Don't reset config
        showLoader(true);
        
        // Configure S3
        AWS.config.region = region;
        AWS.config.credentials = new AWS.Credentials('dummy', 'dummy');
        
        // Helper function to get S3 objects
        function getS3Object(key) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
                
                xhr.open('GET', url, true);
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`Failed to load ${url}: ${xhr.status} ${xhr.statusText}`));
                    }
                };
                xhr.onerror = function() {
                    reject(new Error(`Network error when loading ${url}`));
                };
                xhr.send();
            });
        }
        
        // Try to get the full transcript
        const fullTranscriptKey = `transcripts/${videoId}/full_transcript.json`;
        
        getS3Object(fullTranscriptKey)
            .then(data => {
                try {
                    const jsonData = JSON.parse(data);
                    processTranscript(jsonData);
                } catch (parseErr) {
                    showError("Error parsing transcript data: " + parseErr.message);
                }
            })
            .catch(err => {
                console.log("Full transcript not found, trying to list segments:", err);
                
                // Try using fetch API to list objects
                fetch(`https://${bucketName}.s3.${region}.amazonaws.com/?list-type=2&prefix=transcripts/${videoId}/segments/&delimiter=/`)
                    .then(response => response.text())
                    .then(data => {
                        // Parse XML response
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(data, "text/xml");
                        
                        // Extract segment keys
                        const contents = xmlDoc.getElementsByTagName("Contents");
                        if (!contents || contents.length === 0) {
                            throw new Error("No transcript segments found");
                        }
                        
                        const segmentKeys = [];
                        for (let i = 0; i < contents.length; i++) {
                            const key = contents[i].getElementsByTagName("Key")[0].textContent;
                            if (key.endsWith('.json')) {
                                segmentKeys.push(key);
                            }
                        }
                        
                        if (segmentKeys.length === 0) {
                            throw new Error("No JSON transcript segments found");
                        }
                        
                        // Sort segments by name
                        segmentKeys.sort((a, b) => {
                            const numA = parseInt(a.match(/chunk_(\d+)\.json/)?.[1] || '0');
                            const numB = parseInt(b.match(/chunk_(\d+)\.json/)?.[1] || '0');
                            return numA - numB;
                        });
                        
                        // Load all segment files
                        return Promise.all(segmentKeys.map(key => getS3Object(key)));
                    })
                    .then(segments => {
                        // Parse all segment JSON data
                        const parsedSegments = segments.map(segment => JSON.parse(segment));
                        processSegments(parsedSegments);
                    })
                    .catch(err => {
                        showError("Error loading transcript data: " + err.message);
                    });
            });
    }
    
    function processTranscript(data) {
        transcriptData = {
            segments: data.segments || [],
            language: data.language || 'en',
            video_id: data.video_id
        };
        
        showLoader(false);
        displayTranscript();
        initializeYouTubePlayer();
    }
    
    function processSegments(segments) {
        // Process segments that might be in different formats
        let allSegments = [];
        
        segments.forEach(segment => {
            if (Array.isArray(segment)) {
                allSegments = allSegments.concat(segment);
            } else if (segment.segments && Array.isArray(segment.segments)) {
                allSegments = allSegments.concat(segment.segments);
            } else {
                // It might be a single segment object
                allSegments.push(segment);
            }
        });
        
        // Sort segments by start time
        allSegments.sort((a, b) => a.start - b.start);
        
        transcriptData = {
            segments: allSegments,
            language: 'en',
            video_id: currentVideoId
        };
        
        showLoader(false);
        displayTranscript();
        initializeYouTubePlayer();
    }
    
    function displayTranscript() {
        if (!transcriptData || !transcriptData.segments || transcriptData.segments.length === 0) {
            showError("No transcript data found or empty transcript");
            return;
        }
        
        // Display video info
        const selectedOption = videoSelect.options[videoSelect.selectedIndex];
        videoTitle.textContent = selectedOption ? selectedOption.textContent : `Video ${currentVideoId}`;
        
        // Show content wrapper
        contentWrapper.classList.remove('hidden');
        
        // Display statistics
        segmentCount.textContent = transcriptData.segments.length;
        
        let totalWordCount = 0;
        transcriptData.segments.forEach(segment => {
            if (segment.words && Array.isArray(segment.words)) {
                totalWordCount += segment.words.length;
            }
        });
        wordCount.textContent = totalWordCount;
        
        // Calculate duration
        const lastSegment = transcriptData.segments[transcriptData.segments.length - 1];
        const totalDurationSeconds = lastSegment.end;
        const minutes = Math.floor(totalDurationSeconds / 60);
        const seconds = Math.floor(totalDurationSeconds % 60);
        durationElem.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Calculate pagination
        totalPages = Math.ceil(transcriptData.segments.length / SEGMENTS_PER_PAGE);
        currentPage = 1;
        
        // Render timeline
        renderTimeline();
        
        // Show timeline marker
        timelineMarker.style.display = 'block';
        
        // Render the transcript
        renderTranscript();
    }
    
    function renderTimeline() {
        timelineSegments.innerHTML = '';
        
        if (!transcriptData || !transcriptData.segments.length) return;
        
        const lastSegment = transcriptData.segments[transcriptData.segments.length - 1];
        const totalDuration = lastSegment.end;
        
        transcriptData.segments.forEach((segment, index) => {
            const segmentWidth = ((segment.end - segment.start) / totalDuration) * 100;
            const segmentLeft = (segment.start / totalDuration) * 100;
            
            const segmentElement = document.createElement('div');
            segmentElement.className = 'timeline-segment';
            segmentElement.style.width = `${segmentWidth}%`;
            segmentElement.style.left = `${segmentLeft}%`;
            segmentElement.title = `${formatTime(segment.start)} - ${formatTime(segment.end)}`;
            segmentElement.dataset.index = index;
            segmentElement.dataset.start = segment.start;
            
            // Calculate which page this segment is on
            const segmentPage = Math.floor(index / SEGMENTS_PER_PAGE) + 1;
            
            segmentElement.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent parent timeline click
                
                // Go to the page containing this segment
                if (currentPage !== segmentPage) {
                    currentPage = segmentPage;
                    renderTranscript();
                }
                
                // Seek to the segment's start time
                seekToTime(segment.start);
                
                // Highlight the segment
                highlightSegment(index);
            });
            
            timelineSegments.appendChild(segmentElement);
        });
    }
    
    function renderTranscript() {
        if (!transcriptData || !transcriptData.segments) return;
        
        // Update pagination controls
        updatePaginationControls();
        
        // Calculate segment range for current page
        const startIndex = (currentPage - 1) * SEGMENTS_PER_PAGE;
        const endIndex = Math.min(startIndex + SEGMENTS_PER_PAGE, transcriptData.segments.length);
        
        // Clear transcript container
        transcriptElem.innerHTML = '';
        
        // Render segments for current page
        for (let i = startIndex; i < endIndex; i++) {
            const segment = transcriptData.segments[i];
            renderSegment(segment, i);
        }
        
        // If we have search results, highlight them
        highlightSearchResults();
        
        // If we have an active segment, highlight it
        if (activeSegmentIndex >= startIndex && activeSegmentIndex < endIndex) {
            highlightSegment(activeSegmentIndex);
        }
    }
    
    function renderSegment(segment, index) {
        const segmentElem = document.createElement('div');
        segmentElem.className = 'segment';
        segmentElem.id = `segment-${index}`;
        segmentElem.dataset.index = index;
        segmentElem.dataset.start = segment.start;
        segmentElem.dataset.end = segment.end;
        
        // Time information
        const timeElem = document.createElement('div');
        timeElem.className = 'segment-time';
        
        // Add play button
        const playButton = document.createElement('button');
        playButton.className = 'play-button';
        playButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
        playButton.title = "Play this segment";
        playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            seekToTime(segment.start);
        });
        
        timeElem.appendChild(playButton);
        timeElem.appendChild(document.createTextNode(`${formatTime(segment.start)} - ${formatTime(segment.end)}`));
        segmentElem.appendChild(timeElem);
        
        // Full text
        const textElem = document.createElement('div');
        textElem.className = 'segment-text';
        textElem.textContent = segment.text;
        segmentElem.appendChild(textElem);
        
        // Add click event to play segment
        segmentElem.addEventListener('click', function() {
            seekToTime(segment.start);
        });
        
        // Words with confidence scores
        if (segment.words && Array.isArray(segment.words)) {
            const wordContainer = document.createElement('div');
            wordContainer.className = 'word-container';
            
            segment.words.forEach(word => {
                const wordElem = document.createElement('span');
                wordElem.className = 'word';
                wordElem.textContent = word.word;
                
                // Add confidence class
                if (word.score >= CONFIDENCE_THRESHOLDS.HIGH) {
                    wordElem.classList.add('confidence-high');
                } else if (word.score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
                    wordElem.classList.add('confidence-medium');
                } else {
                    wordElem.classList.add('confidence-low');
                }
                
                // Add tooltip with timing and confidence
                const tooltip = document.createElement('span');
                tooltip.className = 'word-tooltip';
                tooltip.textContent = `${formatTime(word.start)} - ${formatTime(word.end)} (${(word.score * 100).toFixed(1)}%)`;
                wordElem.appendChild(tooltip);
                
                // Add click event to play from word
                wordElem.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent segment click
                    seekToTime(word.start);
                });
                
                wordContainer.appendChild(wordElem);
            });
            
            segmentElem.appendChild(wordContainer);
        }
        
        transcriptElem.appendChild(segmentElem);
    }
    
    function updatePaginationControls() {
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    function seekToTime(seconds) {
        if (!youtubePlayer || !isPlayerReady) {
            initializeYouTubePlayer(seconds);
            return;
        }
        
        youtubePlayer.seekTo(seconds, true);
        youtubePlayer.playVideo();
        
        // Update timeline marker
        updateTimelineMarker(seconds);
        
        // Find the segment that contains this time
        const segmentIndex = findSegmentIndexByTime(seconds);
        if (segmentIndex !== -1) {
            highlightSegment(segmentIndex);
        }
    }
    
    function findSegmentIndexByTime(seconds) {
        if (!transcriptData || !transcriptData.segments) return -1;
        
        for (let i = 0; i < transcriptData.segments.length; i++) {
            const segment = transcriptData.segments[i];
            if (seconds >= segment.start && seconds <= segment.end) {
                return i;
            }
        }
        return -1;
    }
    
    function highlightSegment(index) {
        // Clear previous active segment
        const previousActive = document.querySelector('.segment.active');
        if (previousActive) {
            previousActive.classList.remove('active');
        }
        
        // Highlight new active segment
        const segmentElem = document.getElementById(`segment-${index}`);
        if (segmentElem) {
            segmentElem.classList.add('active');
            
            // Store active segment index
            activeSegmentIndex = index;
            
            // Scroll into view if auto-scroll is enabled and not from user click
            if (autoScroll) {
                segmentElem.scrollIntoView({
                    behavior: 'smooth', 
                    block: 'center'
                });
            }
        }
        
        // If segment is not on current page, switch to correct page
        const segmentPage = Math.floor(index / SEGMENTS_PER_PAGE) + 1;
        if (currentPage !== segmentPage) {
            currentPage = segmentPage;
            renderTranscript();
        }
    }
    
    function updateTimelineMarker(seconds) {
        if (!transcriptData) return;
        
        const lastSegment = transcriptData.segments[transcriptData.segments.length - 1];
        const totalDuration = lastSegment.end;
        
        // Calculate position of the marker
        const position = (seconds / totalDuration) * 100;
        timelineMarker.style.left = `${position}%`;
        
        // Update progress
        timelineProgress.style.width = `${position}%`;
    }
    
    function searchTranscript() {
        const searchPanel = document.getElementById('search-results-panel');
        const searchResultsList = document.getElementById('search-results-list');
        const searchCountElem = document.getElementById('search-count');
        
        const searchText = searchTextInput.value.trim().toLowerCase();
        if (!searchText || !transcriptData || !transcriptData.segments) return;
        
        // Clear previous results
        clearSearch(false);
        searchResultsList.innerHTML = '';
        
        // Search in segments
        transcriptData.segments.forEach((segment, segmentIndex) => {
            const text = segment.text.toLowerCase();
            let startIndex = 0;
            let index;
            
            // Find all occurrences of the search term in this segment
            while ((index = text.indexOf(searchText, startIndex)) !== -1) {
                // Calculate which page this segment is on
                const segmentPage = Math.floor(segmentIndex / SEGMENTS_PER_PAGE) + 1;
                
                // Add to search results
                searchResults.push({ 
                    segmentIndex, 
                    page: segmentPage,
                    start: segment.start,
                    end: segment.end,
                    matchIndex: index,
                    matchText: segment.text.substring(
                        Math.max(0, index - 30), 
                        Math.min(segment.text.length, index + searchText.length + 30)
                    )
                });
                
                // Move to next position
                startIndex = index + searchText.length;
            }
        });
        
        if (searchResults.length > 0) {
            // Show the search results panel
            searchPanel.classList.remove('hidden');
            
            // Display count
            searchCountElem.textContent = `Found ${searchResults.length} matches`;
            
            // Render search results
            renderSearchResults();
            
            // Jump to first result
            jumpToSearchResult(0);
        } else {
            // Hide panel if no results
            searchPanel.classList.add('hidden');
            alert('No matches found');
        }
        
        // Show navigation controls
        if (searchResults.length > 0) {
            searchNavElem.classList.remove('hidden');
            updateSearchNavigation();
        } else {
            searchNavElem.classList.add('hidden');
        }
    }
    
    function renderSearchResults() {
        const searchResultsList = document.getElementById('search-results-list');
        const searchText = searchTextInput.value.trim();
        
        // Clear list
        searchResultsList.innerHTML = '';
        
        // Create a result item for each match
        searchResults.forEach((result, index) => {
            const segment = transcriptData.segments[result.segmentIndex];
            
            // Create result item
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.dataset.index = index;
            
            // Time display
            const timeElem = document.createElement('div');
            timeElem.className = 'search-result-time';
            timeElem.textContent = `${formatTime(segment.start)}`;
            resultItem.appendChild(timeElem);
            
            // Context with highlighted match
            const contextElem = document.createElement('div');
            contextElem.className = 'search-result-context';
            
            // Get the context and highlight the match
            const context = result.matchText;
            const matchStartInContext = context.toLowerCase().indexOf(searchText.toLowerCase());
            
            if (matchStartInContext !== -1) {
                // Text before match
                if (matchStartInContext > 0) {
                    contextElem.appendChild(
                        document.createTextNode(context.substring(0, matchStartInContext))
                    );
                }
                
                // Highlighted match
                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'search-highlight';
                highlightSpan.textContent = context.substring(
                    matchStartInContext, 
                    matchStartInContext + searchText.length
                );
                contextElem.appendChild(highlightSpan);
                
                // Text after match
                if (matchStartInContext + searchText.length < context.length) {
                    contextElem.appendChild(
                        document.createTextNode(context.substring(matchStartInContext + searchText.length))
                    );
                }
            } else {
                // Fallback if we can't find the exact match in the context
                contextElem.textContent = context;
            }
            
            resultItem.appendChild(contextElem);
            
            // Add click event
            resultItem.addEventListener('click', () => {
                jumpToSearchResult(index);
            });
            
            // Add to list
            searchResultsList.appendChild(resultItem);
        });
        
        // Highlight current result
        highlightCurrentSearchResult();
    }
    
    function highlightCurrentSearchResult() {
        // Remove previous highlights
        document.querySelectorAll('.search-result-item.active').forEach(el => {
            el.classList.remove('active');
        });
        
        // Add highlight to current result
        if (currentSearchIndex >= 0 && currentSearchIndex < searchResults.length) {
            const resultItem = document.querySelector(`.search-result-item[data-index="${currentSearchIndex}"]`);
            if (resultItem) {
                resultItem.classList.add('active');
                resultItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    function jumpToSearchResult(index) {
        if (index < 0 || index >= searchResults.length) return;
        
        currentSearchIndex = index;
        const result = searchResults[index];
        
        // Switch to correct page if needed
        if (currentPage !== result.page) {
            currentPage = result.page;
            renderTranscript();
        } else {
            // Just highlight results on current page
            highlightSearchResults();
        }
        
        // Scroll to and highlight the segment
        const segmentElement = document.getElementById(`segment-${result.segmentIndex}`);
        if (segmentElement) {
            segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Also play this segment
            seekToTime(result.start);
        }
        
        // Update highlight in search results list
        highlightCurrentSearchResult();
        
        // Update navigation buttons
        updateSearchNavigation();
    }
    
    function updateSearchNavigation() {
        prevResultBtn.disabled = currentSearchIndex <= 0;
        nextResultBtn.disabled = currentSearchIndex >= searchResults.length - 1;
        searchPageInfo.textContent = `Result ${currentSearchIndex + 1} of ${searchResults.length}`;
    }
    
    function highlightSearchResults() {
        // Remove existing highlights
        document.querySelectorAll('.segment.highlight').forEach(el => {
            el.classList.remove('highlight');
        });
        
        // Nothing to highlight if no search
        if (searchResults.length === 0) return;
        
        // Highlight current search results on this page
        searchResults.forEach((result, index) => {
            if (Math.floor(result.segmentIndex / SEGMENTS_PER_PAGE) + 1 === currentPage) {
                const segmentElement = document.getElementById(`segment-${result.segmentIndex}`);
                if (segmentElement) {
                    // Highlight the segment
                    segmentElement.classList.add('highlight');
                }
            }
        });
    }
    
    function clearSearch(resetInput = true) {
        searchResults = [];
        currentSearchIndex = -1;
        
        // Clear highlight in transcript
        document.querySelectorAll('.segment.highlight').forEach(el => {
            el.classList.remove('highlight');
        });
        
        // Hide search results panel
        document.getElementById('search-results-panel').classList.add('hidden');
        
        // Hide navigation
        searchNavElem.classList.add('hidden');
        
        // Clear search input
        if (resetInput) {
            searchTextInput.value = '';
        }
    }
    
    function initializeYouTubePlayer(startTime = 0) {
        if (!currentVideoId) return;
        
        // If player already exists, destroy it
        if (youtubePlayer) {
            youtubePlayer.destroy();
            youtubePlayer = null;
            isPlayerReady = false;
        }
        
        // Create YouTube player
        youtubePlayer = new YT.Player('youtube-player', {
            videoId: currentVideoId,
            playerVars: {
                'autoplay': 1,
                'start': Math.floor(startTime),
                'playsinline': 1,
                'rel': 0,
                'modestbranding': 1
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    }
    
    function onPlayerReady(event) {
        isPlayerReady = true;
        event.target.playVideo();
        
        // Start progress tracking
        startPlayerProgressTracking();
    }
    
    function onPlayerStateChange(event) {
        // Track play/pause states
        switch(event.data) {
            case YT.PlayerState.PLAYING:
                // Resume progress tracking
                startPlayerProgressTracking();
                break;
                
            case YT.PlayerState.PAUSED:
            case YT.PlayerState.ENDED:
                // Stop progress tracking
                stopPlayerProgressTracking();
                break;
        }
    }
    
    function onPlayerError(event) {
        console.error('YouTube player error:', event.data);
        showError(`YouTube player error: ${getPlayerErrorMessage(event.data)}`);
    }
    
    function getPlayerErrorMessage(errorCode) {
        switch(errorCode) {
            case 2: return 'Invalid video ID';
            case 5: return 'HTML5 player error';
            case 100: return 'Video not found or removed';
            case 101:
            case 150: return 'Video embedding not allowed';
            default: return `Unknown error (${errorCode})`;
        }
    }
    
    let progressTrackingInterval = null;
    
    function startPlayerProgressTracking() {
        // Clear any existing interval
        stopPlayerProgressTracking();
        
        // Update progress every 250ms
        progressTrackingInterval = setInterval(() => {
            if (youtubePlayer && isPlayerReady) {
                const currentTime = youtubePlayer.getCurrentTime();
                
                // Update timeline marker
                updateTimelineMarker(currentTime);
                
                // Update active segment
                const segmentIndex = findSegmentIndexByTime(currentTime);
                if (segmentIndex !== -1 && segmentIndex !== activeSegmentIndex) {
                    highlightSegment(segmentIndex);
                }
            }
        }, 250);
    }
    
    function stopPlayerProgressTracking() {
        if (progressTrackingInterval) {
            clearInterval(progressTrackingInterval);
            progressTrackingInterval = null;
        }
    }
    
    function resetUI(resetVideoSelector = true) {
        showLoader(false);
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
        
        if (resetVideoSelector) {
            videoSelect.disabled = true;
            videoSelect.innerHTML = '<option value="">Select a video...</option>';
            contentWrapper.classList.add('hidden');
        }
    }
    
    function showLoader(show) {
        loader.style.display = show ? 'block' : 'none';
    }
    
    function showError(message) {
        showLoader(false);
        errorMessage.style.display = 'block';
        errorMessage.textContent = message;
    }
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

});
