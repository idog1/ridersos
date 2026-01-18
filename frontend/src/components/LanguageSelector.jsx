import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LanguageSelector({ className = "" }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    if (!saved) {
      localStorage.setItem('language', 'en');
      return 'en';
    }
    return saved;
  });

  const handleLanguageChange = (newLanguage) => {
    localStorage.setItem('language', newLanguage);
    document.documentElement.lang = newLanguage;
    setLanguage(newLanguage);
    window.location.reload();
  };

  return (
    <Select value={language} onValueChange={handleLanguageChange}>
      <SelectTrigger className={`w-[100px] h-8 text-xs border-[#1B4332]/20 ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="he">עברית</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </Select>
  );
}