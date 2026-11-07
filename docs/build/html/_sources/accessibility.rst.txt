Accessibility (a11y) & Keyboard Navigation Guide
=================================================

DECIPHER is designed to comply with WCAG 2.1 AA accessibility guidelines, ensuring complete keyboard operability, screen reader intelligibility, and high-contrast visual cues.

Keyboard Navigation Registry
----------------------------

Global Navigation Chords
~~~~~~~~~~~~~~~~~~~~~~~~
Chord shortcuts use the leader key ``g`` followed by a destination key within 1000ms:

.. list-table::
   :widths: 25 75
   :header-rows: 1

   * - Shortcut
     - Destination
   * - ``g`` + ``h``
     - Navigate to Home / Overview
   * - ``g`` + ``s``
     - Navigate to Studio view
   * - ``g`` + ``l``
     - Navigate to Library view
   * - ``g`` + ``p``
     - Navigate to Profile view
   * - ``g`` + ``c``
     - Navigate to Daily Challenge view

Application Power Hotkeys
~~~~~~~~~~~~~~~~~~~~~~~~~
* ``?``: Toggle Command Palette.
* ``Ctrl + Shift + F``: Launch 3D Flashcards SRS review.
* ``Ctrl + Shift + P``: Open Audio Pronunciation Studio.
* ``Ctrl + Shift + R``: Open RSVP Speed Reader.
* ``Ctrl + Shift + Z``: Launch Zen Focus Pomodoro timer.
* ``Escape``: Dismiss active modal, drawer, or dialog.

Interactive Quiz Mode Shortcuts
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
* ``1``, ``2``, ``3``, ``4``: Select multiple-choice option A, B, C, or D.
* ``Enter`` or ``Space``: Confirm selection and advance to next question.

3D Flashcards SRS Shortcuts
~~~~~~~~~~~~~~~~~~~~~~~~~~~
* ``Space``: Flip card between word prompt and definition.
* ``1``: Rate recall as *Again* (grade 1).
* ``2``: Rate recall as *Hard* (grade 2).
* ``3``: Rate recall as *Good* (grade 3).
* ``4``: Rate recall as *Easy* (grade 5).
* ``ArrowLeft`` / ``ArrowRight``: Navigate previous / next card.

Screen Reader Live Regions
--------------------------

To assist visually impaired users using NVDA, JAWS, or VoiceOver:
* An ARIA live region is injected into ``index.html``:

.. code-block:: html

   <div id="a11yLiveAnnouncer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

* The helper ``announceA11y(message)`` dynamically posts updates for:
  * Quiz question transitions and score summaries.
  * Correct and incorrect answer notifications.
  * Card rating confirmations.
  * Asynchronous sync completion events.

High-Contrast Visual Indicators
-------------------------------

* **High-Contrast Focus Rings**: All interactive controls implement strict ``:focus-visible`` styling:

.. code-block:: css

   :focus-visible {
     outline: 3px solid var(--accent, #6366f1) !important;
     outline-offset: 3px !important;
     box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3) !important;
   }

* **Screen Reader Utility Class**:

.. code-block:: css

   .sr-only {
     position: absolute;
     width: 1px;
     height: 1px;
     padding: 0;
     margin: -1px;
     overflow: hidden;
     clip: rect(0, 0, 0, 0);
     white-space: nowrap;
     border-width: 0;
   }
