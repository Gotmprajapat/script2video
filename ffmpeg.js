// FFmpeg Video Processing Functions
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegProcessor {
    // Create video from images and audio
    async createVideo(params) {
        const { 
            images, 
            audioPath, 
            subtitlePath, 
            outputPath, 
            dimensions, 
            imageDuration,
            musicPath,
            musicVolume 
        } = params;

        return new Promise((resolve, reject) => {
            try {
                // Create image input string
                let ffmpegCommand = 'ffmpeg -y ';
                
                // Add each image as input
                images.forEach((image, index) => {
                    ffmpegCommand += `-loop 1 -t ${imageDuration} -i "${image}" `;
                });
                
                // Add audio input
                ffmpegCommand += `-i "${audioPath}" `;
                
                // Add background music if provided
                if (musicPath && fs.existsSync(musicPath)) {
                    ffmpegCommand += `-i "${musicPath}" `;
                }
                
                // Build filter complex
                let filterComplex = '';
                
                // Scale all images to same size
                for (let i = 0; i < images.length; i++) {
                    filterComplex += `[${i}:v]scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=decrease,pad=${dimensions.width}:${dimensions.height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]; `;
                }
                
                // Concatenate all video streams
                const videoConcat = Array(images.length).fill().map((_, i) => `[v${i}]`).join('');
                filterComplex += `${videoConcat}concat=n=${images.length}:v=1:a=0[outv]; `;
                
                // Handle audio
                if (musicPath && fs.existsSync(musicPath)) {
                    // Mix voice with background music
                    const audioIndex = images.length; // Voice audio index
                    const musicIndex = images.length + 1; // Music index
                    
                    filterComplex += `[${audioIndex}:a]volume=1.0[voice]; `;
                    filterComplex += `[${musicIndex}:a]volume=${musicVolume}[music]; `;
                    filterComplex += `[voice][music]amix=inputs=2:duration=longest[outa]`;
                } else {
                    filterComplex += `[${images.length}:a]anull[outa]`;
                }
                
                // Add subtitles
                if (fs.existsSync(subtitlePath)) {
                    ffmpegCommand += `-filter_complex "${filterComplex}" `;
                    ffmpegCommand += `-map "[outv]" -map "[outa]" `;
                    ffmpegCommand += `-vf "subtitles=${subtitlePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}" `;
                } else {
                    ffmpegCommand += `-filter_complex "${filterComplex}" `;
                    ffmpegCommand += `-map "[outv]" -map "[outa]" `;
                }
                
                // Output options
                ffmpegCommand += `-c:v libx264 -preset medium -crf 23 `;
                ffmpegCommand += `-c:a aac -b:a 128k `;
                ffmpegCommand += `-pix_fmt yuv420p `;
                ffmpegCommand += `-shortest `;
                ffmpegCommand += `"${outputPath}"`;
                
                console.log('Running FFmpeg command:', ffmpegCommand);
                
                // Execute FFmpeg
                exec(ffmpegCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('FFmpeg error:', error);
                        console.error('FFmpeg stderr:', stderr);
                        reject(error);
                    } else {
                        console.log('Video created successfully:', outputPath);
                        resolve(outputPath);
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Extract audio duration
    getAudioDuration(audioPath) {
        return new Promise((resolve, reject) => {
            const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
            
            exec(command, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(parseFloat(stdout));
                }
            });
        });
    }

    // Add watermark to video
    async addWatermark(inputPath, outputPath, watermarkText) {
        return new Promise((resolve, reject) => {
            const command = `ffmpeg -i "${inputPath}" -vf "drawtext=text='${watermarkText}':fontcolor=white:fontsize=24:x=10:y=10" -codec:a copy "${outputPath}"`;
            
            exec(command, (error) => {
                if (error) reject(error);
                else resolve(outputPath);
            });
        });
    }

    // Change video format
    async changeFormat(inputPath, outputPath, format) {
        let dimensions;
        
        switch(format) {
            case '9:16':
                dimensions = '1080:1920';
                break;
            case '16:9':
                dimensions = '1920:1080';
                break;
            case '1:1':
                dimensions = '1080:1080';
                break;
            default:
                dimensions = '1080:1920';
        }
        
        return new Promise((resolve, reject) => {
            const command = `ffmpeg -i "${inputPath}" -vf "scale=${dimensions}:force_original_aspect_ratio=decrease,pad=${dimensions}:(ow-iw)/2:(oh-ih)/2" -c:a copy "${outputPath}"`;
            
            exec(command, (error) => {
                if (error) reject(error);
                else resolve(outputPath);
            });
        });
    }
}

// Export singleton instance
module.exports = new FFmpegProcessor();
