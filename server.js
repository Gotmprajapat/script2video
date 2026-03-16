// Backend Server for Script to Video Generator
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('./ffmpeg.js');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Store generated videos temporarily
const tempVideos = new Map();

// Generate video endpoint
app.post('/generate-video', async (req, res) => {
    try {
        const { sentences, images, audio, format, music, volume, subtitleStyle } = req.body;
        
        console.log('Starting video generation...');
        
        // Create unique job ID
        const jobId = Date.now() + '-' + Math.random().toString(36).substring(7);
        const tempDir = path.join(__dirname, 'temp', jobId);
        
        // Create temp directory
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }
        fs.mkdirSync(tempDir);
        
        // Decode and save audio
        const audioBuffer = Buffer.from(audio, 'base64');
        const audioPath = path.join(tempDir, 'audio.webm');
        fs.writeFileSync(audioPath, audioBuffer);
        
        // Download images
        const imagePaths = [];
        for (let i = 0; i < images.length; i++) {
            const imagePath = path.join(tempDir, `image${i}.jpg`);
            await downloadImage(images[i], imagePath);
            imagePaths.push(imagePath);
        }
        
        // Generate subtitles
        const subtitlePath = path.join(tempDir, 'subtitles.srt');
        generateSubtitles(sentences, subtitlePath, subtitleStyle);
        
        // Calculate duration per image (based on audio length)
        const audioDuration = await getAudioDuration(audioPath);
        const imageDuration = audioDuration / images.length;
        
        // Create video using ffmpeg
        const outputPath = path.join(__dirname, 'temp', `${jobId}.mp4`);
        
        // Build FFmpeg command based on format
        const dimensions = getDimensions(format);
        const musicPath = music !== 'none' ? path.join(__dirname, 'assets', 'music', `${music}.mp3`) : null;
        
        await ffmpeg.createVideo({
            images: imagePaths,
            audioPath: audioPath,
            subtitlePath: subtitlePath,
            outputPath: outputPath,
            dimensions: dimensions,
            imageDuration: imageDuration,
            musicPath: musicPath,
            musicVolume: volume
        });
        
        // Store video path
        const videoUrl = `/temp/${jobId}.mp4`;
        tempVideos.set(jobId, outputPath);
        
        // Clean up temp directory after 1 hour
        setTimeout(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
            if (tempVideos.has(jobId)) {
                fs.unlinkSync(outputPath);
                tempVideos.delete(jobId);
            }
        }, 3600000);
        
        res.json({ 
            success: true, 
            videoUrl: videoUrl,
            jobId: jobId 
        });
        
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Download image from URL
async function downloadImage(url, outputPath) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// Helper: Generate SRT subtitles
function generateSubtitles(sentences, outputPath, style) {
    let srtContent = '';
    let currentTime = 0;
    
    sentences.forEach((sentence, index) => {
        const duration = sentence.length / 15; // Approximate duration based on text length
        const startTime = formatTime(currentTime);
        const endTime = formatTime(currentTime + duration);
        
        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        
        // Apply subtitle style
        if (style === 'yellow') {
            srtContent += `<font color="yellow"><b>${sentence.trim()}</b></font>\n\n`;
        } else {
            srtContent += `${sentence.trim()}\n\n`;
        }
        
        currentTime += duration;
    });
    
    fs.writeFileSync(outputPath, srtContent);
}

// Helper: Format time for SRT
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function pad(num, size = 2) {
    return String(num).padStart(size, '0');
}

// Helper: Get audio duration
function getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`, 
            (error, stdout) => {
                if (error) reject(error);
                resolve(parseFloat(stdout));
            });
    });
}

// Helper: Get video dimensions based on format
function getDimensions(format) {
    switch(format) {
        case '9:16':
            return { width: 1080, height: 1920 };
        case '16:9':
            return { width: 1920, height: 1080 };
        case '1:1':
            return { width: 1080, height: 1080 };
        default:
            return { width: 1080, height: 1920 };
    }
}

// Serve temp files
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
