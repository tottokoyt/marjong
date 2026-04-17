import { useState, useEffect } from 'react';
import { generateProblem } from './mahjong/generator.js';
import { calcAcceptance, bestDiscards } from './mahjong/solver.js';
import { TILE_COLORS, sortTiles } from './mahjong/tiles.js';

const TOTAL_QUESTIONS = 10;
const SUIT_LABEL = { m: '萬', p: '筒', s: '索' };

const PROBLEM_TYPE_LABEL = {
  tenpai:    { text: 'テンパイ問題',   color: 'text-orange-300', bg: 'bg-orange-900/30 border-orange-600' },
  acceptance: null, // built dynamically
};

const SHANTEN_LABEL = {
  0: { text: 'テンパイ',    color: 'text-yellow-300', bg: 'bg-yellow-900/30 border-yellow-600' },
  1: { text: '一向聴',      color: 'text-blue-300',   bg: 'bg-blue-900/30 border-blue-600' },
  2: { text: '両シャンテン', color: 'text-purple-300', bg: 'bg-purple-900/30 border-purple-600' },
  3: { text: '三シャンテン', color: 'text-gray-300',   bg: 'bg-gray-700/40 border-gray-500' },
};

function shantenLabel(s) {
  return SHANTEN_LABEL[s] ?? { text: `${s}シャンテン`, color: 'text-gray-300', bg: 'bg-gray-700/40 border-gray-500' };
}

const SHANTEN_NAME = ['', '一向聴', '両シャンテン', '三シャンテン', '四シャンテン'];
function problemTypeLabel(type, shanten) {
  if (type === 'tenpai') return PROBLEM_TYPE_LABEL.tenpai;
  const name = SHANTEN_NAME[shanten] ?? `${shanten}シャンテン`;
  return { text: `受け広げ問題（${name}）`, color: 'text-blue-300', bg: 'bg-blue-900/30 border-blue-600' };
}

function handShanten(acceptanceResults) {
  return acceptanceResults.length > 0 ? acceptanceResults[0].shanten : 8;
}

// ---------------------------------------------------------------
// Components
// ---------------------------------------------------------------

function TileButton({ tile, onClick, selected, disabled, showResult, isBest }) {
  const suit = tile[tile.length - 1];
  const num = tile.slice(0, -1);
  const color = TILE_COLORS[suit];

  let bg, border, ring;
  if (showResult) {
    if (isBest && selected) {
      bg = 'bg-green-700'; border = 'border-green-400'; ring = 'ring-2 ring-green-300';
    } else if (isBest) {
      bg = 'bg-green-800'; border = 'border-green-500'; ring = 'ring-2 ring-green-400';
    } else if (selected) {
      bg = 'bg-red-800'; border = 'border-red-400'; ring = 'ring-2 ring-red-300';
    } else {
      bg = 'bg-gray-700 opacity-50'; border = 'border-gray-600'; ring = '';
    }
  } else if (selected) {
    bg = 'bg-blue-600 hover:bg-blue-500'; border = 'border-blue-300'; ring = 'ring-2 ring-blue-200';
  } else {
    bg = 'bg-gray-700 hover:bg-gray-600'; border = 'border-gray-500'; ring = '';
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`${bg} ${border} ${ring} border-2 rounded-lg
        px-2 py-2 sm:px-3 sm:py-3
        min-w-[42px] sm:min-w-[52px]
        flex flex-col items-center justify-center
        transition-all duration-100 select-none font-bold active:scale-95`}
    >
      <span className={`${color} text-lg sm:text-xl leading-none`}>{num}</span>
      <span className="text-gray-300 text-[10px] sm:text-xs mt-0.5">{SUIT_LABEL[suit]}</span>
    </button>
  );
}

function TileBadge({ tile }) {
  const suit = tile[tile.length - 1];
  const num = tile.slice(0, -1);
  const color = TILE_COLORS[suit];
  return (
    <span className="inline-flex flex-col items-center bg-gray-700 border border-gray-600 rounded px-1.5 py-1 leading-none">
      <span className={`${color} font-bold text-xs sm:text-sm`}>{num}</span>
      <span className="text-gray-400 text-[9px] sm:text-[10px]">{SUIT_LABEL[suit]}</span>
    </span>
  );
}

function AcceptanceRow({ tile, count, isSelected, isBest, maxCount }) {
  const suit = tile[tile.length - 1];
  const num = tile.slice(0, -1);
  const color = TILE_COLORS[suit];
  const pct = maxCount > 0 ? Math.min(100, (count / maxCount) * 100) : 0;

  return (
    <div className={`flex items-center gap-2 sm:gap-3 py-1.5 px-2 rounded-lg
      ${isBest ? 'bg-green-900/40' : isSelected ? 'bg-red-900/20' : ''}`}>
      <div className="w-16 sm:w-24 flex items-center gap-1 shrink-0">
        <span className={`${color} font-bold text-sm sm:text-base`}>{num}{suit}</span>
        {isBest && <span className="text-yellow-300 text-xs font-bold ml-1">★</span>}
      </div>
      <div className="flex-1 h-2.5 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isBest ? 'bg-green-500' : isSelected ? 'bg-red-500' : 'bg-gray-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-12 sm:w-14 text-right font-mono text-xs sm:text-sm shrink-0
        ${isBest ? 'text-green-400 font-bold' : isSelected ? 'text-red-400' : 'text-gray-400'}`}>
        {count}枚
      </span>
    </div>
  );
}

function AcceptanceTable({ acceptanceResults, selectedTile, bestTiles }) {
  const groups = [];
  let current = null;
  for (const r of acceptanceResults) {
    if (!current || current.shanten !== r.shanten) {
      current = { shanten: r.shanten, rows: [] };
      groups.push(current);
    }
    current.rows.push(r);
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ shanten, rows }) => {
        const sl = shantenLabel(shanten);
        const groupMax = rows[0]?.count ?? 1;
        const isBestGroup = shanten === groups[0].shanten;
        const targetLabel =
          shanten === 0 ? '上がり牌' :
          shanten === 1 ? '→テンパイになる牌' :
          `→${shantenLabel(shanten - 1).text}になる牌`;

        return (
          <div key={shanten}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sl.bg} ${sl.color}`}>
                切り後: {sl.text}
              </span>
              <span className="text-gray-500 text-xs">{targetLabel}</span>
              {isBestGroup && <span className="text-yellow-300 text-xs">← 最善</span>}
            </div>
            <div className="flex flex-col gap-0.5">
              {rows.map(r => (
                <AcceptanceRow
                  key={r.tile}
                  tile={r.tile}
                  count={r.count}
                  isSelected={r.tile === selectedTile}
                  isBest={bestTiles.includes(r.tile)}
                  maxCount={groupMax}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultScreen({ score, onRestart }) {
  const rate = Math.round((score / TOTAL_QUESTIONS) * 100);
  const message =
    rate === 100 ? '完璧！牌効率マスターです！' :
    rate >= 80   ? '素晴らしい！かなり上手です！' :
    rate >= 60   ? '良い調子です！もう少し！' :
    rate >= 40   ? '練習あるのみ！頑張りましょう！' :
                   'まだまだ伸び代あり！繰り返し練習しよう！';

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-gray-800 rounded-2xl p-6 sm:p-10 max-w-md w-full text-center border border-gray-700 shadow-2xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">結果発表</h2>
        <div className="text-6xl sm:text-7xl font-bold text-yellow-300 my-5 sm:my-6">
          {score}<span className="text-2xl sm:text-3xl text-gray-400"> / {TOTAL_QUESTIONS}</span>
        </div>
        <div className="text-lg sm:text-xl text-gray-300 mb-1">
          正解率 <span className="text-green-400 font-bold text-xl sm:text-2xl">{rate}%</span>
        </div>
        <p className="text-gray-400 mt-4 mb-8 text-sm">{message}</p>
        <button
          onClick={onRestart}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3 px-8 sm:px-10 rounded-xl text-base sm:text-lg transition-colors"
        >
          もう一度
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Main App
// ---------------------------------------------------------------
export default function App() {
  const [phase, setPhase] = useState('playing');
  const [questionNum, setQuestionNum] = useState(1);
  const [score, setScore] = useState(0);

  const [hand14, setHand14] = useState([]);
  const [acceptanceResults, setAcceptanceResults] = useState([]);
  const [bestTiles, setBestTiles] = useState([]);
  const [problemType, setProblemType] = useState('tenpai');
  const [problemShanten, setProblemShanten] = useState(0);

  const [selectedTile, setSelectedTile] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  function loadQuestion() {
    const { hand14: h, type, shanten } = generateProblem();
    const results = calcAcceptance(h);
    const best = bestDiscards(results);
    setHand14(h);
    setAcceptanceResults(results);
    setBestTiles(best.map(b => b.tile));
    setProblemType(type);
    setProblemShanten(shanten ?? 0);
    setSelectedTile(null);
    setShowAnswer(false);
    setIsCorrect(null);
  }

  useEffect(() => { loadQuestion(); }, []);

  function handleSelectTile(tile) {
    if (showAnswer) return;
    setSelectedTile(prev => prev === tile ? null : tile);
  }

  function handleShowAnswer() {
    if (!selectedTile || showAnswer) return;
    const correct = bestTiles.includes(selectedTile);
    setIsCorrect(correct);
    setShowAnswer(true);
    if (correct) setScore(s => s + 1);
  }

  function handleNext() {
    if (questionNum >= TOTAL_QUESTIONS) { setPhase('result'); return; }
    setQuestionNum(n => n + 1);
    loadQuestion();
  }

  function handleRestart() {
    setPhase('playing');
    setQuestionNum(1);
    setScore(0);
    loadQuestion();
  }

  if (phase === 'result') return <ResultScreen score={score} onRestart={handleRestart} />;

  const maxCount = acceptanceResults.length > 0 ? acceptanceResults[0].count : 1;
  const bestShantenVal = handShanten(acceptanceResults);
  const sl = shantenLabel(bestShantenVal);
  const bestResults = acceptanceResults.filter(r => bestTiles.includes(r.tile));

  const acceptLabel = bestShantenVal === 0
    ? 'テンパイ待ち牌（上がり牌）'
    : `受け入れ牌（→${shantenLabel(Math.max(0, bestShantenVal - 1)).text}）`;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* ── Header ── */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 sm:px-8 py-3 sm:py-4
        flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <h1 className="text-sm sm:text-xl font-bold text-yellow-300 tracking-wide leading-tight">
          麻雀<span className="hidden sm:inline"> 牌効率トレーニング</span>
          <span className="sm:hidden"> 牌効率</span>
        </h1>
        <div className="flex items-center gap-4 sm:gap-8">
          <span className="text-gray-400 text-xs sm:text-sm">
            問題{' '}
            <span className="text-white font-bold text-base sm:text-lg">{questionNum}</span>
            <span className="text-gray-500"> / {TOTAL_QUESTIONS}</span>
          </span>
          <span className="text-gray-400 text-xs sm:text-sm">
            正解{' '}
            <span className="text-green-400 font-bold text-base sm:text-lg">{score}</span>
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-3 sm:px-8 py-4 sm:py-8
        gap-4 sm:gap-6 max-w-3xl mx-auto w-full">

        {/* 問題タイプラベル */}
        {(() => {
          const pl = problemTypeLabel(problemType, problemShanten);
          return (
            <div className={`self-start px-3 py-1 rounded-full border text-xs sm:text-sm font-bold ${pl.bg} ${pl.color}`}>
              {pl.text}
            </div>
          );
        })()}

        {/* シャンテンバッジ（回答後） */}
        {showAnswer && (
          <div className={`self-start px-3 py-1 rounded-full border text-xs sm:text-sm font-bold ${sl.bg} ${sl.color}`}>
            最善切り後: {sl.text}
          </div>
        )}

        {/* 指示文 */}
        <p className="text-gray-400 text-xs sm:text-sm self-start">
          {showAnswer
            ? '答えを確認してください'
            : problemType === 'tenpai'
            ? 'ツモった14枚から、切ったら最も広く聴牌できる切り牌を選んでください'
            : 'ツモった14枚から、最も受け入れが広くなる切り牌を選んでください'}
        </p>

        {/* 手牌（14枚） */}
        <section className="w-full">
          <h2 className="text-gray-500 text-[10px] sm:text-xs mb-2 sm:mb-3 uppercase tracking-widest">
            手牌（14枚）
          </h2>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {hand14.map((tile, i) => (
              <TileButton
                key={i}
                tile={tile}
                onClick={() => handleSelectTile(tile)}
                selected={tile === selectedTile}
                disabled={showAnswer}
                showResult={showAnswer}
                isBest={bestTiles.includes(tile)}
              />
            ))}
          </div>
        </section>

        {/* ボタン */}
        <div className="flex gap-3 sm:gap-4 self-start">
          {!showAnswer ? (
            <button
              onClick={handleShowAnswer}
              disabled={!selectedTile}
              className={`font-bold py-2.5 px-6 sm:px-8 rounded-xl text-sm sm:text-base transition-colors
                ${selectedTile
                  ? 'bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-gray-900'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
            >
              答えを見る
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white
                font-bold py-2.5 px-6 sm:px-8 rounded-xl text-sm sm:text-base transition-colors"
            >
              {questionNum >= TOTAL_QUESTIONS ? '結果を見る →' : '次の問題 →'}
            </button>
          )}
        </div>

        {/* 正誤バナー */}
        {showAnswer && (
          <div className={`w-full rounded-xl p-3 sm:p-4 border
            ${isCorrect ? 'bg-green-900/30 border-green-600' : 'bg-red-900/30 border-red-600'}`}>
            <div className="flex items-start gap-2 flex-wrap">
              <span className={`text-base sm:text-xl font-bold shrink-0
                ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? '✓ 正解！' : '✗ 不正解'}
              </span>
              <span className="text-gray-300 text-xs sm:text-sm">
                {isCorrect
                  ? `「${selectedTile}」は最善の切り牌です！（${acceptanceResults.find(r => r.tile === selectedTile)?.count ?? '?'}枚受け）`
                  : `「${selectedTile}」は最善ではありませんでした。最善: ${bestTiles.join(', ')}（${maxCount}枚受け）`}
              </span>
            </div>
          </div>
        )}

        {/* 最善切り牌と受け入れ牌 */}
        {showAnswer && bestResults.length > 0 && (
          <section className="w-full bg-gray-800 rounded-xl p-4 sm:p-5 border border-green-800">
            <h3 className="text-green-400 text-[10px] sm:text-xs font-semibold mb-3 sm:mb-4 uppercase tracking-widest">
              ★ 最善の切り牌と{acceptLabel}
            </h3>
            <div className="flex flex-col gap-4 sm:gap-5">
              {bestResults.map(r => (
                <div key={r.tile}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-gray-300 text-xs sm:text-sm">
                      <span className={`${TILE_COLORS[r.tile[r.tile.length - 1]]} font-bold text-sm sm:text-base`}>
                        {r.tile}
                      </span>
                      {' '}を切る →{' '}
                      <span className="text-green-400 font-bold">{r.count}枚</span>受け
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {sortTiles(r.acceptingTiles).map(w => (
                      <TileBadge key={w} tile={w} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 切り牌別受け入れテーブル（シャンテン別グループ） */}
        {showAnswer && (
          <section className="w-full bg-gray-800 rounded-xl p-4 sm:p-5 border border-gray-700">
            <h3 className="text-gray-400 text-[10px] sm:text-xs font-semibold mb-3 sm:mb-4 uppercase tracking-widest">
              切り牌別 受け入れ枚数
            </h3>
            <AcceptanceTable
              acceptanceResults={acceptanceResults}
              selectedTile={selectedTile}
              bestTiles={bestTiles}
            />
          </section>
        )}
      </main>
    </div>
  );
}
