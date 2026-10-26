import { h } from '../../../shared/src/dom.js';
import type { DebugView } from '../../../shared/src/modes/views.js';
import type { StageMode } from './types.js';

export const debugStage: StageMode<DebugView> = {
  badge: (game, id) => `${game.answered.includes(id) ? '✎' : ''}${game.voted.includes(id) ? '✓' : ''}`,

  render(view, game) {
    switch (view.phase) {
      case 'intro':
        return h('div', { class: 'card' }, h('p', { class: 'big' }, 'こんばんは！ Welcome to Kotoba Party'), h('p', { class: 'hint' }, 'Debug round.'));
      case 'prompt':
      case 'answer':
        return h(
          'div',
          { class: 'card' },
          h('p', { class: 'prompt' }, game.prompt?.text ?? ''),
          game.prompt?.subtitle ? h('p', { class: 'subtitle', lang: 'ja' }, game.prompt.subtitle) : null,
          view.phase === 'answer' ? h('p', { class: 'hint' }, `${game.answered.length} / ${view.players.length} answers in`) : null,
        );
      case 'reveal':
        return h(
          'div',
          { class: 'card' },
          h('p', { class: 'prompt small' }, game.prompt?.text ?? ''),
          h('ol', { class: 'answers' }, game.reveal.map((a) => h('li', {}, a.text))),
          h('p', { class: 'hint' }, `${game.voted.length} votes in`),
        );
      default: {
        const answers = [...(game.results ?? [])].sort((a, b) => b.votes - a.votes);
        return h(
          'div',
          { class: 'card' },
          h('p', { class: 'prompt small' }, game.prompt?.text ?? ''),
          h(
            'ol',
            { class: 'answers results' },
            answers.map((a, i) =>
              h(
                'li',
                { class: a.ippon ? 'ippon' : i === 0 && a.votes > 0 ? 'winner' : '' },
                h('span', { class: 'text' }, a.text),
                h('span', { class: 'by' }, `${a.authorName} · ${a.votes} vote${a.votes === 1 ? '' : 's'} · +${a.points}`),
                a.ippon ? h('span', { class: 'badge' }, 'IPPON!') : null,
              ),
            ),
          ),
        );
      }
    }
  },
};
