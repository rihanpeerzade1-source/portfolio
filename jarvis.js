import os
import datetime
import webbrowser
import subprocess
import smtplib
import wikipedia
import pyttsx3
import speech_recognition as sr
import openai
from dotenv import load_dotenv
import random
import threading
import time
import json

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize TTS
engine = pyttsx3.init()
engine.setProperty('rate', 185)
engine.setProperty('volume', 1.0)
voices = engine.getProperty('voices')
engine.setProperty('voice', voices[1].id)  # Female voice

# Global variables
conversation_history = []
reminders = []
wake_word = "jarvis"

# ========== SPEAK & LISTEN ==========
def speak(text):
    print(f"🤖 Jarvis: {text}")
    engine.say(text)
    engine.runAndWait()

def listen():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("🎤 Listening...")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=8)
            command = recognizer.recognize_google(audio)
            print(f"🧑 You: {command}")
            return command.lower()
        except sr.WaitTimeoutError:
            return ""
        except sr.UnknownValueError:
            return ""
        except sr.RequestError:
            speak("Network error. Please check internet.")
            return ""

# ========== AI BRAIN ==========
def ask_ai(prompt):
    conversation_history.append({"role": "user", "content": prompt})
    
    # Keep last 10 messages for context
    if len(conversation_history) > 10:
        conversation_history.pop(0)
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are Jarvis, an AI assistant. Be helpful, concise, and slightly witty. Respond in Hinglish or English as the user prefers."},
                *conversation_history
            ],
            max_tokens=200,
            temperature=0.8
        )
        reply = response.choices[0].message.content
        conversation_history.append({"role": "assistant", "content": reply})
        return reply
    except Exception as e:
        return f"AI error: {str(e)}"

# ========== COMMAND EXECUTOR ==========
def execute_command(command):
    # Wake word check
    if wake_word not in command and not command.startswith(("hey", "ok")):
        return
    
    command = command.replace(wake_word, "").strip()
    
    # ===== GREETINGS =====
    if any(word in command for word in ["hello", "hi", "hey"]):
        greetings = ["Hello sir!", "Hi there!", "How can I help you today?"]
        speak(random.choice(greetings))
        return
    
    # ===== TIME & DATE =====
    if "time" in command:
        now = datetime.datetime.now().strftime("%I:%M %p")
        speak(f"It's {now}")
        return
    
    if "date" in command:
        today = datetime.datetime.now().strftime("%B %d, %Y")
        speak(f"Today is {today}")
        return
    
    # ===== WEB =====
    if "youtube" in command:
        speak("Opening YouTube")
        webbrowser.open("https://youtube.com")
        return
    
    if "google" in command or "search" in command:
        query = command.replace("google", "").replace("search", "").strip()
        if query:
            webbrowser.open(f"https://google.com/search?q={query}")
            speak(f"Searching for {query}")
        else:
            speak("What should I search?")
        return
    
    if "wikipedia" in command:
        query = command.replace("wikipedia", "").strip()
        if query:
            try:
                summary = wikipedia.summary(query, sentences=2)
                speak(summary)
            except:
                speak("No results found on Wikipedia")
        return
    
    # ===== MUSIC =====
    if "play music" in command or "song" in command:
        music_dir = "C:/Users/YourName/Music"  # Change this!
        try:
            songs = os.listdir(music_dir)
            if songs:
                song = os.path.join(music_dir, random.choice(songs))
                subprocess.Popen([song], shell=True)
                speak("Playing music")
            else:
                speak("No music found")
        except:
            speak("Music folder not found")
        return
    
    # ===== EMAIL =====
    if "send email" in command:
        speak("Who should I send it to?")
        to = listen()
        speak("What's the subject?")
        subject = listen()
        speak("What should I say?")
        body = listen()
        
        try:
            msg = f"Subject: {subject}\n\n{body}"
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(os.getenv("EMAIL_ADDRESS"), os.getenv("EMAIL_PASSWORD"))
            server.sendmail(os.getenv("EMAIL_ADDRESS"), to, msg)
            server.quit()
            speak("Email sent successfully!")
        except:
            speak("Failed to send email. Check credentials.")
        return
    
    # ===== REMINDERS =====
    if "remind" in command:
        speak("What should I remind you about?")
        task = listen()
        speak("After how many minutes?")
        try:
            minutes = int(listen())
            reminder_time = datetime.datetime.now() + datetime.timedelta(minutes=minutes)
            reminders.append({"task": task, "time": reminder_time})
            speak(f"Reminder set for {minutes} minutes later")
            
            # Background thread for reminder
            threading.Thread(target=check_reminders, daemon=True).start()
        except:
            speak("Invalid time")
        return
    
    # ===== SYSTEM =====
    if "shutdown" in command:
        speak("Shutting down system. Goodbye!")
        os.system("shutdown /s /t 5")
        return
    
    if "restart" in command:
        speak("Restarting system")
        os.system("shutdown /r /t 5")
        return
    
    # ===== EXIT =====
    if any(word in command for word in ["bye", "exit", "quit", "goodbye"]):
        speak("Goodbye sir! Have a great day!")
        exit()
    
    # ===== AI FALLBACK =====
    speak("Let me think...")
    reply = ask_ai(command)
    speak(reply)

# ========== REMINDER CHECKER ==========
def check_reminders():
    while True:
        now = datetime.datetime.now()
        for reminder in reminders[:]:
            if now >= reminder["time"]:
                speak(f"Reminder: {reminder['task']}")
                reminders.remove(reminder)
        time.sleep(30)

# ========== WAKE WORD LISTENER (Background) ==========
def wake_listener():
    while True:
        command = listen()
        if command and wake_word in command:
            execute_command(command)
        time.sleep(0.5)

# ========== MAIN ==========
if __name__ == "__main__":
    speak("Jarvis activated. How can I assist you?")
    
    # Start background listener
    listener_thread = threading.Thread(target=wake_listener, daemon=True)
    listener_thread.start()
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        speak("Shutting down Jarvis")