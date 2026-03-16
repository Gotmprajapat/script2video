// Main Frontend JavaScript for Script to Video Generator

class VideoGenerator {
    constructor() {
        // Initialize DOM elements
        this.scriptInput = document.getElementById('script');
        this.charCount = document.getElementById('charCount');
        this.generateBtn = document.getElementById('generateBtn');
        this.voiceType = document.getElementById('voiceType');
        this.speed = document.getElementById('speed');
        this.speedValue = document.getElementById('speedValue');
        this.format = document.getElementById('format');
        this.music = document.getElementById('music');
        this.subtitleStyle = document.getElementById('subtitleStyle');
        this.volume = document.getElementById('volume');
        this.progressContainer = document.querySelector('.progress-container');
        this.progressFill = document.querySelector('.progress-fill');
        this.progressStatus = document.getElementById('progressStatus');
        this.videoSection = document.querySelector('.video-section');
        this.videoPreview = document.getElementById('videoPreview');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.loader = document.querySelector('.loader');

        // Bind event listeners
        this.scriptInput.addEventListener('input', () => this.updateCharCount());
        this.speed.addEventListener('input', () => this.updateSpeed());
        this.generateBtn.addEventListener('click', () => this.startGeneration());

        // Initialize speech synthesis
        this.speechSynth = window.speechSynthesis;
        this.voices = [];
        
        // Load voices when available
        if (this.speechSynth) {
            this.speechSynth.onvoiceschanged = () => {
                this.voices = this.speechSynth.getVoices();
            };
        }

        // Pexels API key (you'll need to replace this with your own)
        this.pexelsApiKey = '563492ad6f91700001000001c1a0b6d3c8b14c5e9b3b3b3b3b3b3b3b'; // Demo key - replace with real one
    }

    // Update character count
    updateCharCount() {
        const count = this.scriptInput.value.length;
        this.charCount.textContent = count;
        
        // Limit to 1000 characters
        if (count > 1000) {
            this.scriptInput.value = this.scriptInput.value.substring(0, 1000);
            this.charCount.textContent = 1000;
        }
    }

    // Update speed display
    updateSpeed() {
        this.speedValue.textContent = this.speed.value + 'x';
    }

    // Start video generation process
    async startGeneration() {
        const script = this.scriptInput.value.trim();
        
        if (!script) {
            alert('Please enter a script first!');
            return;
        }

        // Show loading state
        this.setLoadingState(true);
        this.progressContainer.style.display = 'block';
        this.videoSection.style.display = 'none';
        this.updateProgress(10, 'Analyzing script...');

        try {
            // Split script into sentences
            const sentences = this.splitIntoSentences(script);
            this.updateProgress(20, 'Fetching images...');
            
            // Fetch images for each sentence
            const images = await this.fetchImages(sentences);
            this.updateProgress(40, 'Generating voiceover...');
            
            // Generate audio for the script
            const audioBlob = await this.generateVoiceover(script);
            this.updateProgress(60, 'Creating video...');
            
            // Prepare video data
            const videoData = {
                sentences: sentences,
                images: images,
                audioBlob: audioBlob,
                format: this.format.value,
                music: this.music.value,
                volume: this.volume.value,
                subtitleStyle: this.subtitleStyle.value
            };
            
            this.updateProgress(80, 'Rendering final video...');
            
            // Send to server for video generation
            const result = await this.generateVideo(videoData);
            
            this.updateProgress(100, 'Complete!');
            
            // Display the generated video
            this.displayVideo(result.videoUrl);
            
        } catch (error) {
            console.error('Generation error:', error);
            alert('Error generating video: ' + error.message);
            this.setLoadingState(false);
            this.progressContainer.style.display = 'none';
        }
    }

    // Split script into sentences
    splitIntoSentences(script) {
        // Simple sentence splitting
        return script.match(/[^.!?]+[.!?]+/g) || [script];
    }

    // Fetch images from Pexels API
    async fetchImages(sentences) {
        const images = [];
        
        for (let sentence of sentences) {
            try {
                // Extract keywords from sentence (simplified)
                const keywords = sentence.split(' ').slice(0, 3).join(' ');
                
                // Call Pexels API
                const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1`, {
                    headers: {
                        'Authorization': this.pexelsApiKey
                    }
                });
                
                const data = await response.json();
                
                if (data.photos && data.photos.length > 0) {
                    images.push(data.photos[0].src.medium);
                } else {
                    // Fallback to placeholder image
                    images.push(`https://picsum.photos/800/1200?random=${Math.random()}`);
                }
            } catch (error) {
                console.error('Image fetch error:', error);
                // Use placeholder on error
                images.push(`https://picsum.photos/800/1200?random=${Math.random()}`);
            }
        }
        
        return images;
    }

    // Generate voiceover using Web Speech API
    async generateVoiceover(script) {
        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(script);
            
            // Set voice based on selection
            if (this.voices.length > 0) {
                const voice = this.voiceType.value === 'male' 
                    ? this.voices.find(v => v.name.includes('Male') || v.name.includes('David'))
                    : this.voices.find(v => v.name.includes('Female') || v.name.includes('Samantha'));
                
                if (voice) utterance.voice = voice;
            }
            
            // Set speech rate
            utterance.rate = parseFloat(this.speed.value);
            
            // Create audio context and recorder
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioContext.createMediaStreamDestination();
            const recorder = new MediaRecorder(dest.stream);
            const chunks = [];
            
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                resolve(blob);
            };
            
            // Start recording
            recorder.start();
            
            // Speak the text
            this.speechSynth.speak(utterance);
            
            utterance.onend = () => {
                recorder.stop();
                audioContext.close();
            };
            
            utterance.onerror = reject;
        });
    }

    // Send data to server for video generation
    async generateVideo(videoData) {
        // Convert audio blob to base64
        const audioBase64 = await this.blobToBase64(videoData.audioBlob);
        
        // Prepare data for server
        const requestData = {
            sentences: videoData.sentences,
            images: videoData.images,
            audio: audioBase64,
            format: videoData.format,
            music: videoData.music,
            volume: videoData.volume,
            subtitleStyle: videoData.subtitleStyle
        };
        
        // Send to server
        const response = await fetch('/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error('Server error');
        }
        
        return await response.json();
    }

    // Helper: Convert blob to base64
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Update progress bar
    updateProgress(percent, status) {
        this.progressFill.style.width = percent + '%';
        this.progressStatus.textContent = status;
    }

    // Display generated video
    displayVideo(videoUrl) {
        this.setLoadingState(false);
        this.progressContainer.style.display = 'none';
        this.videoSection.style.display = 'block';
        
        // Set video source
        this.videoPreview.src = videoUrl;
        this.downloadBtn.href = videoUrl;
    }

    // Set loading state
    setLoadingState(isLoading) {
        this.generateBtn.disabled = isLoading;
        this.loader.style.display = isLoading ? 'inline-block' : 'none';
        this.generateBtn.querySelector('span').style.display = isLoading ? 'none' : 'inline';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoGenerator();
});
