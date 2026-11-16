import { useEffect, useRef, useState } from 'react';
import type { Question, Response } from '../types';
import { shuffle, words } from '../lib/grade';

interface Props {
  q: Question;
  value: Response;
  onChange: (value: Response) => void;
  /** Đã bấm "Kiểm tra": khoá lại và tô màu đáp án. */
  locked: boolean;
}

/** Hình minh hoạ: emoji hoặc đường link ảnh. */
export function QuestionImage({ image }: { image: string }) {
  if (!image) return null;
  return /^(https?:|data:)/.test(image) ? <img className="q-img" src={image} alt="" /> : <div className="q-emoji">{image}</div>;
}

export function QuestionInput({ q, value, onChange, locked }: Props) {
  switch (q.type) {
    case 'multiple_choice':
      return <Choices options={q.options.map((text, i) => ({ value: i, text }))} answer={q.answer} value={value} onChange={onChange} locked={locked} />;
    case 'true_false':
      return (
        <Choices
          twoColumns
          options={[
            { value: true, text: '✔ Đúng' },
            { value: false, text: '✘ Sai' },
          ]}
          answer={q.answer}
          value={value}
          onChange={onChange}
          locked={locked}
        />
      );
    case 'fill_blank':
      return <Fill value={typeof value === 'string' ? value : ''} onChange={onChange} locked={locked} />;
    case 'matching':
      return <Matching pairs={q.pairs} value={Array.isArray(value) ? value : q.pairs.map(() => null)} onChange={onChange} locked={locked} />;
    case 'word_order':
      return <WordOrder sentence={q.answer} onChange={onChange} locked={locked} />;
  }
}

function Choices<T extends number | boolean>(props: { options: { value: T; text: string }[]; answer: T; value: Response; onChange: (v: Response) => void; locked: boolean; twoColumns?: boolean }) {
  return (
    <div className={'opts' + (props.twoColumns ? ' opts-tf' : '') + (props.locked ? ' locked' : '')}>
      {props.options.map((o) => {
        const selected = props.value === o.value;
        const mark = !props.locked ? '' : o.value === props.answer ? ' right' : selected ? ' wrong' : '';
        return (
          <button type="button" key={String(o.value)} className={'opt' + (selected ? ' sel' : '') + mark} onClick={() => props.onChange(o.value)}>
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

function Fill({ value, onChange, locked }: { value: string; onChange: (v: Response) => void; locked: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return <input ref={ref} className="fill" type="text" value={value} disabled={locked} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Gõ câu trả lời..." onChange={(e) => onChange(e.target.value)} />;
}

/** Nối cặp: chạm một ô bên trái rồi chạm ô bên phải. value[i] = vị trí ô phải được nối với ô trái thứ i. */
function Matching({ pairs, value, onChange, locked }: { pairs: { left: string; right: string }[]; value: (number | null)[]; onChange: (v: Response) => void; locked: boolean }) {
  const [rightOrder] = useState(() => shuffle(pairs.map((_, i) => i)));
  const [pick, setPick] = useState<number | null>(null);

  const tapLeft = (i: number) => {
    if (value[i] != null) onChange(value.map((v, k) => (k === i ? null : v)));
    setPick(pick === i ? null : i);
  };
  const tapRight = (ri: number) => {
    const next = value.map((v) => (v === ri ? null : v));
    if (pick != null) next[pick] = ri;
    setPick(null);
    onChange(next);
  };

  return (
    <div className={locked ? 'locked' : ''}>
      <div className="match">
        <div className="match-col">
          {pairs.map((p, i) => (
            <button type="button" key={i} className={'m-item' + (value[i] != null ? ' pair-' + (i % 6) : '') + (pick === i ? ' sel' : '')} onClick={() => tapLeft(i)}>
              {p.left}
            </button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map((ri) => {
            const li = value.indexOf(ri);
            return (
              <button type="button" key={ri} className={'m-item' + (li >= 0 ? ' pair-' + (li % 6) : '')} onClick={() => tapRight(ri)}>
                {pairs[ri].right}
              </button>
            );
          })}
        </div>
      </div>
      <p className="hint">Chạm một ô bên trái, rồi chạm ô đúng bên phải.</p>
    </div>
  );
}

/** Sắp xếp câu: chạm các từ theo thứ tự để ghép thành câu. */
function WordOrder({ sentence, onChange, locked }: { sentence: string; onChange: (v: Response) => void; locked: boolean }) {
  const [tokens] = useState(() => words(sentence));
  const [bank] = useState(() => {
    const order = shuffle(tokens.map((_, i) => i));
    // Nếu xáo trộn ra đúng thứ tự gốc thì đảo ngược lại, kẻo câu hỏi lộ luôn đáp án
    return tokens.length > 1 && order.every((v, i) => v === i) ? order.reverse() : order;
  });
  const [chosen, setChosen] = useState<number[]>([]);

  const update = (next: number[]) => {
    setChosen(next);
    onChange(next.map((i) => tokens[i]).join(' '));
  };

  return (
    <div className={locked ? 'locked' : ''}>
      <div className="wo-line">
        {chosen.length ? (
          chosen.map((i) => (
            <button type="button" key={i} className="chip" onClick={() => update(chosen.filter((x) => x !== i))}>
              {tokens[i]}
            </button>
          ))
        ) : (
          <span className="wo-empty">Chạm vào các từ bên dưới</span>
        )}
      </div>
      <div className="wo-bank">
        {bank.map((i) => (
          <button type="button" key={i} className={'chip' + (chosen.includes(i) ? ' used' : '')} onClick={() => !chosen.includes(i) && update([...chosen, i])}>
            {tokens[i]}
          </button>
        ))}
      </div>
    </div>
  );
}
