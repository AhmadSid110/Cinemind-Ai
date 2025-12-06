import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number; // 0-10 rating
  onChange: (rating: number) => void;
  size?: number;
  readOnly?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({ 
  value, 
  onChange, 
  size = 20, 
  readOnly = false 
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const stars = Array.from({ length: 10 }, (_, i) => i + 1);
  
  const handleClick = (rating: number) => {
    if (!readOnly) {
      onChange(rating);
    }
  };
  
  const displayValue = hoverValue ?? value;
  
  return (
    <div className="flex items-center gap-1">
      {stars.map((rating) => {
        const filled = displayValue >= rating;
        
        return (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            onMouseEnter={() => !readOnly && setHoverValue(rating)}
            onMouseLeave={() => !readOnly && setHoverValue(null)}
            disabled={readOnly}
            className={`transition-all ${!readOnly && 'hover:scale-110 cursor-pointer'} ${readOnly && 'cursor-default'}`}
          >
            <Star
              size={size}
              className={`transition-colors ${
                filled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-slate-600'
              } ${!readOnly && 'hover:text-yellow-300'}`}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm font-bold text-slate-300">
        {value > 0 ? `${value}/10` : 'Rate'}
      </span>
    </div>
  );
};

export default StarRating;
