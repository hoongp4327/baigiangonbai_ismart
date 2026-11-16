import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLessonText, validateLesson } from './validate';
import { SAMPLE_LESSON } from './sample';

describe('validateLesson', () => {
  it('nhận bài mẫu', () => {
    const v = validateLesson(SAMPLE_LESSON);
    expect(v.errors).toEqual([]);
    expect(v.lesson?.questions).toHaveLength(10);
  });
  it('nhận file lớp 11 trong thư mục sample', () => {
    const v = parseLessonText(readFileSync('sample/unit1-lop11.json', 'utf8'));
    expect(v.errors).toEqual([]);
    expect(v.lesson?.questions).toHaveLength(11);
    expect(v.lesson?.grade).toBe('11');
  });
  it('báo lỗi rõ theo từng câu', () => {
    const v = validateLesson({
      title: '',
      questions: [
        { type: 'essay', prompt: 'x' },
        { type: 'multiple_choice', prompt: 'x', options: ['a'], answer: 0 },
        { type: 'multiple_choice', prompt: 'x', options: ['a', 'b'], answer: 5 },
        { type: 'true_false', prompt: 'x', answer: 'maybe' },
        { type: 'fill_blank', prompt: 'x', answer: [' '] },
        { type: 'matching', prompt: 'x', pairs: [{ left: 'a' }, { left: 'b', right: 'c' }] },
        { type: 'word_order', prompt: 'x', answer: 'Hello' },
        { type: 'true_false', answer: true },
      ],
    });
    expect(v.lesson).toBeNull();
    expect(v.errors).toHaveLength(9);
    expect(v.errors[0]).toContain('title');
    expect(v.errors[1]).toContain('Câu 1');
    expect(v.errors[1]).toContain('essay');
    expect(v.errors[8]).toContain('Câu 8');
  });
  it('tự sửa các kiểu đáp án AI hay viết lệch', () => {
    const v = validateLesson({
      title: 'T',
      grade: 5,
      questions: [
        { type: 'multiple_choice', prompt: 'x', options: ['cat', 'dog'], answer: 'Dog' },
        { type: 'multiple_choice', prompt: 'x', options: ['cat', 'dog'], answer: '1' },
        { type: 'true_false', prompt: 'x', answer: 'TRUE' },
        { type: 'fill_blank', prompt: 'x', answer: 'cats', skill: 'khong-co' },
      ],
    });
    expect(v.errors).toEqual([]);
    const q = v.lesson!.questions;
    expect(q[0]).toMatchObject({ answer: 1 });
    expect(q[1]).toMatchObject({ answer: 1 });
    expect(q[2]).toMatchObject({ answer: true });
    expect(q[3]).toMatchObject({ answer: ['cats'], skill: 'vocabulary' });
    expect(v.lesson!.grade).toBe('5');
  });
  it('từ chối thứ không phải bài học', () => {
    expect(validateLesson(null).lesson).toBeNull();
    expect(validateLesson([1, 2]).lesson).toBeNull();
    expect(validateLesson({ title: 'T', questions: [] }).errors[0]).toContain('questions');
  });
});

describe('parseLessonText', () => {
  it('gỡ khối ```json mà AI hay bọc quanh', () => {
    const v = parseLessonText('Đây là bài:\n```json\n{"title":"T","questions":[{"type":"true_false","prompt":"x","answer":true}]}\n```\nChúc bạn dạy tốt');
    expect(v.errors).toEqual([]);
    expect(v.lesson?.title).toBe('T');
  });
  it('báo lỗi khi JSON hỏng', () => {
    const v = parseLessonText('{"title": "T", ');
    expect(v.lesson).toBeNull();
    expect(v.errors[0]).toContain('Không đọc được JSON');
  });
});
