'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { Song } from '../lib/leaderboard';
import { calcRating, old35, new15 } from '../lib/song-calc'

const css = `
  
`;

export default function BestFifty({ data = [] }: { data?: Song[] }) {
  const router = useRouter();

  const b35 = old35(data);
  const b15 = new15(data);
  const rating = calcRating(data)

  return (
  <div style={{ padding: '0 2rem 2rem 2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h1>Rating: {rating}</h1>
        <h2>B15</h2>
        <table className="score-table">
            <thead>
            <tr>
                <th>Level</th>
                <th>Internal Level</th>
                <th>Rating</th>
                <th>Song</th>
                <th style={{ textAlign: 'right' }}>Achievement</th>
                <th>AP?</th>
            </tr>
            </thead>
            <tbody>
            {b15.map((song) => (
                <tr key={`${song.difficulty}-${song.kind}-${song.title}`} className="lb-row">
                <td>{song.level}</td>
                <td>{song.internal_difficulty}</td>
                <td>{Math.floor(song.rating)}</td>
                <td>{song.title}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {song.achievement == null ? '—' : `${song.achievement.toFixed(4)}%`}
                </td>
                <td>{(song.ap).toString()}</td>
                </tr>
            ))}
            </tbody>
        </table>
        <h2>B35</h2>
        <table className="score-table">
            <thead>
            <tr>
                <th>Level</th>
                <th>Internal Level</th>
                <th>Rating</th>
                <th>Song</th>
                <th style={{ textAlign: 'right' }}>Achievement</th>
                <th>AP?</th>
            </tr>
            </thead>
            <tbody>
            {b35.map((song) => (
                <tr key={`${song.difficulty}-${song.kind}-${song.title}`} className="lb-row">
                <td>{song.level}</td>
                <td>{song.internal_difficulty}</td>
                <td>{Math.floor(song.rating)}</td>
                <td>{song.title}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {song.achievement == null ? '—' : `${song.achievement.toFixed(4)}%`}
                </td>
                <td>{(song.ap).toString()}</td>
                </tr>
            ))}
            </tbody>
        </table>
  </div>
);
}