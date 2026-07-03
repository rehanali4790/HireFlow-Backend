const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {
  cleanTranscription,
  isLikelyHallucination,
  buildWhisperPrompt,
  mapLanguagePreference,
  getAverageNoSpeechProb,
} = require('../utils/transcription');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({
  dest: 'uploads/audio/',
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  },
});

async function transcribeInterviewAudio(tempFilePath, languagePreference = 'both') {
  const fileStats = fs.statSync(tempFilePath);
  if (fileStats.size < 4000) {
    return {
      text: '',
      low_quality: true,
      reason: 'audio_too_short',
    };
  }

  const whisperLanguage = mapLanguagePreference(languagePreference);
  const request = {
    file: fs.createReadStream(tempFilePath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    temperature: 0,
    prompt: buildWhisperPrompt(languagePreference),
  };

  if (whisperLanguage) {
    request.language = whisperLanguage;
  }

  const transcription = await openai.audio.transcriptions.create(request);
  const avgNoSpeech = getAverageNoSpeechProb(transcription.segments || []);

  if (avgNoSpeech > 0.55) {
    return {
      text: '',
      low_quality: true,
      reason: 'no_clear_speech',
      no_speech: true,
    };
  }

  const cleaned = cleanTranscription(transcription.text || '');
  if (!cleaned || isLikelyHallucination(cleaned)) {
    return {
      text: '',
      low_quality: true,
      reason: 'hallucination',
      hallucination: true,
    };
  }

  return {
    text: cleaned,
    duration: transcription.duration || null,
    low_quality: false,
  };
}

router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      speed: 0.95,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });

    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error.message,
    });
  }
});

router.post('/stt', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const languagePreference = req.body.language || 'both';
    const originalExt = path.extname(req.file.originalname) || '.webm';
    tempFilePath = req.file.path + originalExt;
    fs.renameSync(req.file.path, tempFilePath);

    const result = await transcribeInterviewAudio(tempFilePath, languagePreference);

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json(result);
  } catch (error) {
    console.error('STT error:', error);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(500).json({
      error: 'Failed to transcribe audio',
      message: error.message,
    });
  }
});

router.post('/stt-stream', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio chunk is required' });
    }

    const languagePreference = req.body.language || 'both';
    const originalExt = path.extname(req.file.originalname) || '.webm';
    tempFilePath = req.file.path + originalExt;
    fs.renameSync(req.file.path, tempFilePath);

    const result = await transcribeInterviewAudio(tempFilePath, languagePreference);

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      ...result,
      is_final: true,
    });
  } catch (error) {
    console.error('STT stream error:', error);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(500).json({
      error: 'Failed to transcribe audio chunk',
      message: error.message,
    });
  }
});

module.exports = router;
