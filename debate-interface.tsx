"use client"

import { useState, useEffect, useRef } from "react" // Import useRef
import { Button } from "@/components/ui/button"
import { Mic, MicOff, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DebateInterface() {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [recentlyStoppedListening, setRecentlyStoppedListening] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunks = useRef([]); // Use useRef here

  useEffect(() => {
    const storedConversationId = localStorage.getItem('conversationId');
    if (storedConversationId) {
      setConversationId(storedConversationId);
      loadConversationHistory(storedConversationId);
    } else {
      const newConversationId = crypto.randomUUID();
      setConversationId(newConversationId);
      localStorage.setItem('conversationId', newConversationId);
    }
  }, []);

  useEffect(() => {
    if (!isListening && recentlyStoppedListening) {
      const interval = setInterval(() => {
        setAudioLevel(Math.random());
      }, 100);
      return () => clearInterval(interval);
    }
    return () => { };
  }, [isListening, recentlyStoppedListening]);

  const loadConversationHistory = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/conversation_history/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setTranscript([{ speaker: "System", message: "No conversation history found." }]);
        } else {
          console.error("Error loading conversation history:", response.status);
          setTranscript([{ speaker: "System", message: "Error loading conversation history." }]);
        }
        return;
      }
      const history = await response.json();
      const formattedTranscript = history.map(turn => ({
        speaker: turn.ai_response ? "AI" : "You",
        message: turn.ai_response || "Audio Turn",
      }));
      setTranscript(formattedTranscript);
    } catch (error) {
      console.error("Error loading conversation history:", error);
      setTranscript([{ speaker: "System", message: "Error loading conversation history." }]);
    }
  };

  const handleListeningToggle = async () => {
    if (isListening) {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      setIsListening(false);
      setRecentlyStoppedListening(true);
      setIsThinking(true);
      setTimeout(() => setRecentlyStoppedListening(false), 5000);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        setMediaRecorder(recorder);
        audioChunks.current = []; // Clear previous chunks using .current

        recorder.ondataavailable = event => {
          audioChunks.current.push(event.data); // Use .current here
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' }); // And here
          const audioBase64 = await blobToBase64(audioBlob);
          setTranscript(prevTranscript => [...prevTranscript, { speaker: "You", message: "Audio Turn" }]);
          await sendAudioToBackend(audioBase64);
        };

        recorder.start();
        setIsListening(true);
        setRecentlyStoppedListening(false);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
  };

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function sendAudioToBackend(audioBase64) {
    try {
      const response = await fetch('https://ai-debater-u58n.onrender.com/debate-turn/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_data: audioBase64,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setTranscript(prevTranscript => [...prevTranscript, { speaker: "AI", message: data.ai_response_text }]);
      playAudioFromBase64(data.ai_response_audio_base64);
      setIsThinking(false);
    } catch (error) {
      console.error("Error sending audio to backend:", error);
      setTranscript(prevTranscript => [...prevTranscript, { speaker: "System", message: "Error processing audio." }]);
      setIsThinking(false);
    }
  }

  function playAudioFromBase64(base64Audio) {
    if (base64Audio) {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audio.play().catch(error => {
        console.error("Error playing audio:", error);
      });
    } else {
      console.warn("No audio data received from the server.");
    }
  }

  return (
    // ... (rest of your JSX code remains the same) ...
    <div className="min-h-screen bg-black flex flex-col items-center p-4 relative overflow-hidden">
      {/* Title */}
      <h1 className="text-4xl font-bold text-white mb-12 mt-8 text-center">
        <span className="bg-gradient-to-r from-blue-500 to-emerald-500 text-transparent bg-clip-text">
          Human PMs vs AI:
        </span>
        <span className="ml-2 text-neutral-200">The Great Debate</span>
      </h1>

      <div className="relative w-full max-w-2xl aspect-square flex flex-col items-center justify-center">
        {/* Outer glow ring */}
        <div
          className={`absolute w-full h-full rounded-full transition-all duration-500 ${
            isListening
              ? "border-[1px] border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
              : recentlyStoppedListening
                ? "border-[1px] border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.3)]"
                : "border-[1px] border-neutral-800"
          }`}
        />

        {/* Dotted circle */}
        <div className="absolute w-[95%] h-[95%] rounded-full border-[2px] border-dotted border-neutral-800" />

        {/* Audio visualization */}
        <div className="relative w-[80%] h-[80%] flex items-center justify-center">
          {recentlyStoppedListening && (
            <div className="flex items-center gap-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-emerald-500"
                  style={{
                    height: `${Math.sin(i * audioLevel * Math.PI) * 100}px`,
                    transition: "height 0.1s ease-in-out",
                    opacity: 0.5 + Math.sin(i * 0.2) * 0.5,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status text */}
        <div
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-lg font-medium tracking-wide transition-colors duration-500 ${
            isListening ? "text-blue-500" : recentlyStoppedListening ? "text-emerald-500" : "text-neutral-600"
          }`}
        >
          {isListening ? "listening" : ""}
        </div>

        {/* Thinking indicator */}
        {isThinking && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-sm text-neutral-400 mt-2">Thinking...</p>
          </div>
        )}

        {/* Talk button */}
        <Button
          onClick={handleListeningToggle}
          className={`absolute bottom-[15%] h-16 px-8 rounded-full transition-all duration-500 ${
            isListening
              ? "bg-blue-500 hover:bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          {isListening ? <MicOff className="w-6 h-6 mr-2" /> : <Mic className="w-6 h-6 mr-2" />}
          {isListening ? "Stop" : "Start"} Listening
        </Button>
      </div>

      {/* Transcript Button */}
      <Button
        onClick={() => setShowTranscript(!showTranscript)}
        className="fixed top-4 right-4 bg-neutral-800 hover:bg-neutral-700"
      >
        <FileText className="w-5 h-5 mr-2" />
        Transcript
      </Button>

      {/* Transcript Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-96 bg-neutral-900/95 backdrop-blur-sm border-l border-neutral-800 p-6 transition-transform duration-300 ease-in-out",
          showTranscript ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-200">Transcript</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTranscript(false)}
            className="text-neutral-400 hover:text-neutral-200"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto h-[calc(100%-6rem)]">
          {transcript.map((item, index) => (
            <div key={index} className="text-neutral-400">
              <p className="text-sm text-neutral-500 mb-1">{item.speaker}</p>
              <p>{item.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
