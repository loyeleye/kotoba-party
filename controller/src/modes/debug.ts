import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { DebugView } from '../../../shared/src/modes/views.js';
import { waiting } from '../components/ui.js';
import type { PhoneMode } from './types.js';

export const debugPhone: PhoneMode<DebugView> = {
  key: (view, game) => [view.phaseSeq, game.mine?.answerId, game.mine?.votedFor].join('|'),

  render({ view, game, send }) {
    switch (view.phase) {
      case 'answer': {
        if (game.mine?.answerText) return waiting(`Sent: “${game.mine.answerText}”`, 'Waiting for the others…');
        const input = h('input', { maxlength: MAX_ANSWER_LENGTH, placeholder: 'Your answer', lang: 'ja' }) as HTMLInputElement;
        return h(
          'form',
          {
            class: 'screen',
            onsubmit: (e: Event) => {
              e.preventDefault();
              if (input.value.trim()) void send({ kind: 'answer', text: input.value });
            },
          },
          h('p', { class: 'prompt' }, game.prompt?.text ?? ''),
          input,
          h('button', { class: 'primary', type: 'submit' }, 'Send'),
        );
      }
      case 'reveal': {
        if (game.mine?.votedFor) return waiting('Vote in!', 'Waiting for the others…');
        const options = game.reveal.filter((a) => a.id !== game.mine?.answerId);
        if (!options.length) return waiting('Nothing to vote for', '');
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'hint' }, 'Vote for the funniest:'),
          options.map((a) => h('button', { class: 'option', onclick: () => void send({ kind: 'vote', answerId: a.id }) }, a.text)),
        );
      }
      case 'encore':
      case 'score': {
        const mine = game.results?.find((a) => a.answerId === game.mine?.answerId);
        return waiting(mine ? `+${mine.points}${mine.ippon ? ' · IPPON!' : ''}` : 'No answer this round', mine ? `${mine.votes} votes for “${mine.text}”` : '');
      }
      default:
        return waiting('Look at the screen!', game.prompt?.text ?? '');
    }
  },
};
