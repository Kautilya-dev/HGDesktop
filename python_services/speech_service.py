import os
import sys
import json
import pyaudio
from google.cloud import speech

# 🔑 Load credentials from local JSON beside script
script_dir = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(script_dir, "speechtotext-463312-e7acf95cc2c8.json")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

# ✅ Initialize Google Speech Client
client = speech.SpeechClient()

# 🔧 Audio configuration
RATE = 16000
CHUNK = 512

# 🎤 Initialize PyAudio
p = pyaudio.PyAudio()

# 🔎 Find Virtual Audio Cable device index
device_index = None
for i in range(p.get_device_count()):
    dev = p.get_device_info_by_index(i)
    if "Virtual Audio Cable" in dev["name"] and dev["maxInputChannels"] > 0:
        device_index = i
        break

if device_index is None:
    print(json.dumps({"error": "Virtual Audio Cable not found"}))
    sys.exit(1)

# 🎙️ Open audio stream
stream = p.open(format=pyaudio.paInt16,
                channels=1,
                rate=RATE,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=CHUNK)

frames = []
for _ in range(0, int(RATE / CHUNK * 5)):  # Capture ~5 seconds
    data = stream.read(CHUNK, exception_on_overflow=False)
    frames.append(data)

stream.stop_stream()
stream.close()
p.terminate()

# 📝 Prepare audio for Google STT
audio = speech.RecognitionAudio(content=b''.join(frames))
config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=RATE,
    language_code="en-US"
)

# 🔊 Recognize speech
response = client.recognize(config=config, audio=audio)
transcript = response.results[0].alternatives[0].transcript if response.results else ''

# ✅ Output transcript as JSON
print(json.dumps({"transcript": transcript}))
sys.stdout.flush()
