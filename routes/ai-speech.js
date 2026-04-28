const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for audio file uploads
const upload = multer({
  dest: 'uploads/audio/',
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  }
});

/**
 * Text-to-Speech: Convert AI question to speech
 * POST /api/ai-speech/tts
 */
router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    console.log('🔊 Generating speech for text:', text.substring(0, 50) + '...');
    
    // Generate speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1', // or 'tts-1-hd' for higher quality
      voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
      input: text,
      speed: 0.95, // Slightly slower for better clarity
    });
    
    // Convert response to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Set headers for audio streaming
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });
    
    res.send(buffer);
    console.log('✅ Speech generated successfully');
    
  } catch (error) {
    console.error('❌ TTS error:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      message: error.message 
    });
  }
});

/**
 * Speech-to-Text: Convert candidate's audio response to text
 * POST /api/ai-speech/stt
 */
router.post('/stt', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    console.log('🎤 Transcribing audio file:', req.file.originalname);
    
    // OpenAI Whisper requires specific file extensions
    const originalExt = path.extname(req.file.originalname) || '.webm';
    tempFilePath = req.file.path + originalExt;
    
    // Rename file to include extension
    fs.renameSync(req.file.path, tempFilePath);
    
    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en', // Can be auto-detected by removing this
      response_format: 'json',
      temperature: 0.2, // Lower temperature for more accurate transcription
    });
    
    console.log('✅ Transcription successful:', transcription.text.substring(0, 50) + '...');
    
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    res.json({
      text: transcription.text,
      duration: transcription.duration || null,
    });
    
  } catch (error) {
    console.error('❌ STT error:', error);
    
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      message: error.message 
    });
  }
});

/**
 * Real-time Speech-to-Text for streaming audio
 * POST /api/ai-speech/stt-stream
 */
router.post('/stt-stream', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio chunk is required' });
    }
    
    console.log('🎤 Transcribing audio chunk...');
    
    const originalExt = path.extname(req.file.originalname) || '.webm';
    tempFilePath = req.file.path + originalExt;
    fs.renameSync(req.file.path, tempFilePath);
    
    // Transcribe chunk
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en',
      response_format: 'json',
      temperature: 0.2,
    });
    
    // Clean up
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    res.json({
      text: transcription.text,
      is_final: true,
    });
    
  } catch (error) {
    console.error('❌ STT stream error:', error);
    
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio chunk',
      message: error.message 
    });
  }
});

module.exports = router;
