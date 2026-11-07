SuperMemo SM-2 Spaced Repetition Engine
========================================

DECIPHER incorporates the SuperMemo SM-2 spaced repetition algorithm to optimize vocabulary retention and counteract Ebbinghaus's forgetting curve.

Mathematical Formulation
-------------------------

The algorithm calculates the review interval ($I$) and ease factor ($EF$) based on the user's recall quality rating ($q \in \{0, 1, 2, 3, 4, 5\}$).

1. Interval Progression
~~~~~~~~~~~~~~~~~~~~~~~

For a given repetition count $n$:

.. math::

   I(n) = \begin{cases} 
   1 & \text{for } n = 1 \\
   6 & \text{for } n = 2 \\
   \text{round}(I(n-1) \times EF) & \text{for } n > 2 
   \end{cases}

If the recall grade $q < 3$ (lapse):
* The repetition count $n$ resets to $0$.
* The next interval $I$ resets to $1$ day.

2. Ease Factor Update
~~~~~~~~~~~~~~~~~~~~~

The ease factor reflects item difficulty and updates after every review:

.. math::

   EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))

* **Minimum Ease Factor Bound**: $EF' \ge 1.3$.
* Initial card ease factor defaults to $2.5$.

Recall Grade Scale ($q$)
------------------------

.. list-table::
   :widths: 10 25 65
   :header-rows: 1

   * - Grade ($q$)
     - Quality
     - Description
   * - 5
     - Perfect
     - Instant, flawless recall with zero hesitation.
   * - 4
     - Good
     - Correct response after brief hesitation.
   * - 3
     - Pass
     - Correct response recalled with serious difficulty.
   * - 2
     - Hard Fail
     - Incorrect response; correct answer felt familiar upon reveal.
   * - 1
     - Fail
     - Incorrect response; correct answer remembered only upon reveal.
   * - 0
     - Blackout
     - Complete failure of recall; total unfamiliarity.

Review Queue Manager Architecture
---------------------------------

The ``SRSQueueManager`` class in ``modules/srs.js`` orchestrates card lifecycles:

* **Card State Schema**:
  * ``repetitions``: Integer count of consecutive successful reviews.
  * ``interval``: Scheduled interval in days.
  * ``ef``: Floating-point ease factor ($\ge 1.3$).
  * ``lastReviewed``: Epoch millisecond timestamp of last review.
  * ``dueDate``: Epoch millisecond timestamp when card is due (``lastReviewed + interval * 86,400,000``).
* **Card Tier Classification**:
  * *New / Learning*: $I < 6$ days.
  * *Reviewing*: $6 \le I < 21$ days.
  * *Mature*: $I \ge 21$ days.

Weak Words Drill Room Integration
---------------------------------

Words with high failure rates are automatically routed to the Weak Words queue (``modules/drill.js``). The drill engine categorizes mistakes into:
1. ``spelling_typo``: Levenshtein distance $\le 2$.
2. ``near_miss``: Partial phonetic or morphological match.
3. ``confused_definition``: Mismatched vocabulary definition.
4. ``unanswered``: Timeout or blank submission.

Graduation from the Weak Words queue requires **3 consecutive successful recalls**.
