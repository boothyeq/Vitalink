import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Using standard div for scrolling to ensure reliability, ScrollArea can sometimes be finicky with dynamic heights
import { Loader2, Send, Bot, User, AlertCircle, Sparkles } from "lucide-react";
import { sendSymptomMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Markdown from "react-markdown";

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
};

export default function SymptomChecker() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [patientId, setPatientId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function init() {
            const { data } = await supabase.auth.getSession();
            const userId = data?.session?.user?.id;
            if (userId) {
                setPatientId(userId);
                setMessages([{
                    id: '1',
                    role: 'assistant',
                    content: `Hello! I'm your Vitalink AI Health Assistant. I can help answer questions about your symptoms and health data. 

**Important:** I'm not a doctor and cannot diagnose conditions. If you're experiencing a medical emergency (chest pain, difficulty breathing, stroke symptoms), please call emergency services immediately.

How can I help you today?`,
                    timestamp: new Date().toISOString()
                }]);
            }
        }
        init();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!input.trim() || !patientId) {
            if (!patientId) toast.error("Unable to identify user. Please log in again.");
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const response = await sendSymptomMessage(userMessage.content, patientId);
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.response,
                timestamp: response.timestamp
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err: any) {
            toast.error(err.message || "Failed to get response. Please try again.");
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm sorry, I encountered an error processing your request. Please try again or contact your healthcare provider if you have urgent concerns.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const suggestedQuestions = [
        "What do my recent vitals indicate?",
        "I'm feeling short of breath, what should I do?",
        "How can I manage my heart failure better?",
        "What are signs I should call my doctor?",
    ];

    return (
        <main className="mx-auto max-w-5xl px-4 py-6 h-screen max-h-screen flex flex-col">
            <div className="mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    AI Symptom Checker
                </h2>
                <p className="text-muted-foreground mt-1">
                    Get personalized health insights based on your vitals and symptoms
                </p>
            </div>

            {/* Main Chat Card - Flex-1 ensures it fills available space but respects screen limits */}
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-md">
                <CardHeader className="border-b px-4 py-3 flex-shrink-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bot className="w-5 h-5 text-primary" />
                        Chat with AI Assistant
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Ask questions about your symptoms, vitals, or general health
                    </CardDescription>
                </CardHeader>

                {/* Content Area - Flex column to separate messages from input */}
                <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden relative">

                    {/* Messages Container - Overflow Auto handles the scrolling */}
                    <div
                        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                        ref={scrollRef}
                    >
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex gap-3 w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                )}

                                <div
                                    className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                            : 'bg-muted/50 border rounded-bl-none'
                                        }`}
                                >
                                    <div className="markdown prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                                        <Markdown>{message.content}</Markdown>
                                    </div>
                                    <p className={`text-[10px] mt-1 text-right ${message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                        }`}>
                                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>

                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                                        <User className="w-5 h-5 text-primary-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex gap-3 justify-start w-full animate-pulse">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-5 h-5 text-primary" />
                                </div>
                                <div className="bg-muted rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground">Analyzing health data...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Area: Suggestions + Disclaimer + Input */}
                    <div className="flex-shrink-0 border-t bg-background z-10">

                        {/* Suggested Questions (only if chat is empty/start) */}
                        {messages.length === 1 && (
                            <div className="px-4 pt-3 pb-1 bg-muted/20">
                                <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Suggested questions:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {suggestedQuestions.map((question, idx) => (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setInput(question);
                                                // Optional: Auto send immediately
                                                // handleSend(); 
                                            }}
                                            className="text-left justify-start h-auto py-2 px-3 whitespace-normal"
                                        >
                                            <span className="text-xs truncate w-full">{question}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Disclaimer Bar */}
                        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50 flex justify-center">
                            <div className="flex items-center gap-1.5 text-center">
                                <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                                <p className="text-[10px] font-medium text-amber-800 dark:text-amber-300">
                                    AI provides info, not diagnosis. Consult a doctor for medical advice.
                                </p>
                            </div>
                        </div>

                        {/* Input Form */}
                        <div className="p-3 sm:p-4 bg-background">
                            <form onSubmit={handleSend} className="flex gap-2 relative">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type your symptoms..."
                                    disabled={loading}
                                    className="flex-1 pr-12 h-11" // extra padding for mobile ease
                                />
                                <Button
                                    type="submit"
                                    disabled={loading || !input.trim()}
                                    size="icon"
                                    className="absolute right-1 top-1 h-9 w-9 my-auto"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}