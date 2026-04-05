'use client';

const QUESTIONS = [
  "Tell me about yourself",
  "What's your professional experience?",
  "What projects have you worked on?",
  "What kind of role are you looking for?",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return ( 
    <div className="flex flex-col gap-10">
      {QUESTIONS.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="text-left px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-800 text-sm font-medium transition-colors duration-150 hover:bg-gray-100"
        >
          {q}
        </button>
      ))}

      <a
        href="mailto:guilhermeloges@gmail.com"
        className="mt-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold text-center shadow-lg shadow-violet-500/30 transition-all duration-200 hover:shadow-violet-500/50 hover:-translate-y-0.5 active:scale-95"
      >
        Hire Me
      </a>
    </div>
  );
}
