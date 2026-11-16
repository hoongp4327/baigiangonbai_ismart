import { describe, expect, it } from 'vitest';
import type { Question } from '../types';
import { answerText, grade, isAnswered, norm } from './grade';

const base = { skill: 'vocabulary' as const, prompt: 'p', passage: '', image: '', audio_text: '', audio_url: '', explanation: '' };
const mc: Question = { ...base, type: 'multiple_choice', options: ['cat', 'dog', 'bird'], answer: 1 };
const tf: Question = { ...base, type: 'true_false', answer: false };
const fill: Question = { ...base, type: 'fill_blank', answer: ['cats', 'kittens'] };
const match: Question = {
  ...base,
  type: 'matching',
  pairs: [
    { left: 'dog', right: 'chó' },
    { left: 'cat', right: 'mèo' },
    { left: 'fish', right: 'cá' },
  ],
};
const order: Question = { ...base, type: 'word_order', answer: 'Do you have any rabbits?' };

describe('norm', () => {
  it('bỏ qua hoa thường, khoảng trắng thừa và dấu câu cuối', () => {
    expect(norm(' Cats. ')).toBe('cats');
    expect(norm('Do you  have any rabbits ?')).toBe('do you have any rabbits');
    expect(norm('I’m fine!')).toBe("i'm fine");
    expect(norm(null)).toBe('');
  });
  it('giữ dấu câu ở giữa câu', () => {
    expect(norm('Yes, I do.')).toBe('yes, i do');
  });
});

describe('grade', () => {
  it('trắc nghiệm', () => {
    expect(grade(mc, 1)).toEqual({ correct: true, correctText: 'dog', responseText: 'dog' });
    expect(grade(mc, 0)).toMatchObject({ correct: false, responseText: 'cat' });
    expect(grade(mc, null)).toMatchObject({ correct: false, responseText: '' });
    expect(grade(mc, 9)).toMatchObject({ correct: false, responseText: '' });
  });
  it('đúng / sai', () => {
    expect(grade(tf, false).correct).toBe(true);
    expect(grade(tf, true)).toMatchObject({ correct: false, correctText: 'Sai', responseText: 'Đúng' });
    expect(grade(tf, null).correct).toBe(false);
  });
  it('điền từ: chấp nhận mọi đáp án trong danh sách', () => {
    expect(grade(fill, ' Cats. ').correct).toBe(true);
    expect(grade(fill, 'KITTENS').correct).toBe(true);
    expect(grade(fill, 'cat')).toMatchObject({ correct: false, responseText: 'cat', correctText: 'cats' });
    expect(grade(fill, '').correct).toBe(false);
  });
  it('nối cặp: phải đúng tất cả các cặp', () => {
    expect(grade(match, [0, 1, 2]).correct).toBe(true);
    expect(grade(match, [1, 0, 2])).toMatchObject({ correct: false, responseText: 'dog → mèo, cat → chó, fish → cá' });
    expect(grade(match, [0, 1])).toMatchObject({ correct: false, responseText: 'dog → chó, cat → mèo, fish → ?' });
    expect(grade(match, null).correct).toBe(false);
  });
  it('sắp xếp câu: không phân biệt hoa thường và dấu cuối câu', () => {
    expect(grade(order, 'Do you have any rabbits?').correct).toBe(true);
    expect(grade(order, 'do you have any rabbits').correct).toBe(true);
    expect(grade(order, 'you Do have any rabbits?').correct).toBe(false);
  });
});

describe('isAnswered', () => {
  it('chỉ cho kiểm tra khi đã trả lời đủ', () => {
    expect(isAnswered(mc, null)).toBe(false);
    expect(isAnswered(mc, 0)).toBe(true);
    expect(isAnswered(tf, false)).toBe(true);
    expect(isAnswered(fill, '   ')).toBe(false);
    expect(isAnswered(fill, 'a')).toBe(true);
    expect(isAnswered(match, [0, null, 2])).toBe(false);
    expect(isAnswered(match, [2, 1, 0])).toBe(true);
    expect(isAnswered(order, 'Do you have')).toBe(false);
    expect(isAnswered(order, 'any Do you have rabbits?')).toBe(true);
  });
});

describe('answerText', () => {
  it('hiển thị đáp án cho từng dạng', () => {
    expect(answerText(mc)).toBe('dog');
    expect(answerText(tf)).toBe('Sai');
    expect(answerText(fill)).toBe('cats');
    expect(answerText(match)).toBe('dog → chó, cat → mèo, fish → cá');
    expect(answerText(order)).toBe('Do you have any rabbits?');
  });
});
