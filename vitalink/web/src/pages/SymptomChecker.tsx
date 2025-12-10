import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, AlertCircle, Sparkles } from "lucide-react";
import { sendSymptomMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";

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
                // Add welcome message
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
        // Scroll to bottom when messages change
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!input.trim() || !patientId) {
            if (!patientId) {
                toast.error("Unable to identify user. Please log in again.");
            }
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

            // Add error message to chat
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

    const handleSuggestedQuestion = (question: string) => {
        setInput(question);
    };

    return (
        <main className="mx-auto max-w-5xl px-4 py-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    AI Symptom Checker
                </h2>
                <p className="text-muted-foreground mt-1">
                    Get personalized health insights based on your vitals and symptoms
                </p>
            </div>

            <Card className="h-[calc(100vh-240px)] flex flex-col">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        Chat with AI Assistant
                    </CardTitle>
                    <CardDescription>
                        Ask questions about your symptoms, vitals, or general health
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col p-0">
                    {/* Messages Area */}
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Bot className="w-5 h-5 text-primary" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[80%] rounded-lg p-3 ${message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                        <p className="text-xs opacity-70 mt-1">
                                            {new Date(message.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>

                                    {message.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-primary-foreground" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="bg-muted rounded-lg p-3">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Suggested Questions (only show when no messages) */}
                    {messages.length === 1 && (
                        <div className="px-4 pb-4 border-t pt-4">
                            <p className="text-sm text-muted-foreground mb-2">Suggested questions:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {suggestedQuestions.map((question, idx) => (
                                    <Button
                                        key={idx}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSuggestedQuestion(question)}
                                        className="text-left justify-start h-auto py-2 px-3"
                                    >
                                        <span className="text-xs">{question}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Disclaimer */}
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-900">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                This AI assistant provides general information only. Always consult your healthcare provider for medical advice.
                            </p>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t">
                        <form onSubmit={handleSend} className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your question or describe your symptoms..."
                                disabled={loading}
                                className="flex-1"
                            />
                            <Button type="submit" disabled={loading || !input.trim()} size="icon">
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
