<script setup>
import { RouterLink } from 'vue-router'
import OfflineBanner from '../components/OfflineBanner.vue'
</script>

<template>
  <div class="page guide-page">
    <OfflineBanner />
    <header class="page-header">
      <RouterLink to="/" class="back-link">← Dashboard</RouterLink>
      <h1>Maintenance how-to guide</h1>
      <p class="muted">
        General practices many owners follow. Your vehicle’s owner’s manual and a qualified technician
        always win when they differ from this overview.
      </p>
    </header>

    <nav class="card guide-toc" aria-label="On this page">
      <h2 class="toc-title">On this page</h2>
      <ul class="toc-list">
        <li><a href="#oil">Engine oil &amp; filter</a></li>
        <li><a href="#fluids">Fluids &amp; filters</a></li>
        <li><a href="#tires">Tires &amp; alignment</a></li>
        <li><a href="#brakes">Brakes</a></li>
        <li><a href="#battery">Battery &amp; electrics</a></li>
        <li><a href="#belts">Belts &amp; hoses</a></li>
        <li><a href="#seasonal">Seasonal checks</a></li>
        <li><a href="#records">Records &amp; mileage</a></li>
      </ul>
    </nav>

    <article class="guide-article card" id="oil">
      <h2>Engine oil &amp; filter</h2>
      <p>
        Oil lubricates and cools internal parts. Old oil breaks down and can allow extra wear. Most
        manufacturers suggest a mileage <em>or</em> time interval (whichever comes first).
      </p>
      <ul>
        <li>Check the dipstick on level ground with the engine off and cooled slightly; stay between min and max.</li>
        <li>Use the grade and specification listed in your manual (e.g. ACEA/API ratings).</li>
        <li>Replace the oil filter whenever you change oil.</li>
        <li>If you often drive short trips or in dust or heat, intervals may need to be shorter.</li>
      </ul>
    </article>

    <article class="guide-article card" id="fluids">
      <h2>Fluids &amp; filters</h2>
      <p>Beyond engine oil, periodically inspect or service:</p>
      <ul>
        <li><strong>Coolant</strong> — level and condition; many cars use long-life coolant but still need checks for leaks and concentration.</li>
        <li><strong>Brake fluid</strong> — absorbs moisture over time; many schedules call for replacement every ~2 years.</li>
        <li><strong>Transmission fluid</strong> — follow the manual; some units are “lifetime” sealed, others need service intervals.</li>
        <li><strong>Power steering &amp; windshield washer</strong> — top up with the correct fluid type.</li>
        <li><strong>Air filter</strong> — a clogged filter hurts fuel economy and performance; inspect yearly or more in dusty areas.</li>
        <li><strong>Cabin filter</strong> — improves HVAC and air quality; often yearly or every second service.</li>
      </ul>
    </article>

    <article class="guide-article card" id="tires">
      <h2>Tires &amp; alignment</h2>
      <ul>
        <li>Check pressure monthly (cold tires) using the sticker on the door jamb, not only the sidewall maximum.</li>
        <li>Inspect tread depth and uneven wear; uneven wear can signal alignment or suspension issues.</li>
        <li>Rotate tires per the manual (often every 5,000–8,000 mi) so they wear evenly.</li>
        <li>After hitting a curb or pothole hard, consider an alignment check if the steering pulls or vibrates.</li>
      </ul>
    </article>

    <article class="guide-article card" id="brakes">
      <h2>Brakes</h2>
      <ul>
        <li>Listen for squeal or grind, and note if the pedal feels soft or the car pulls under braking.</li>
        <li>Pads and discs wear with use; city driving and hills wear them faster.</li>
        <li>Handbrake / parking brake should hold the car on a moderate slope.</li>
      </ul>
    </article>

    <article class="guide-article card" id="battery">
      <h2>Battery &amp; electrics</h2>
      <ul>
        <li>Typical lead-acid batteries last about 3–5 years in many climates; heat accelerates aging.</li>
        <li>Clean corroded terminals carefully; ensure clamps are tight.</li>
        <li>If starts become slow or the battery is old, have it load-tested before you’re stranded.</li>
      </ul>
    </article>

    <article class="guide-article card" id="belts">
      <h2>Belts &amp; hoses</h2>
      <ul>
        <li>Serpentine belt: look for cracks, glazing, or squeal on startup; replace on schedule if the manual lists intervals.</li>
        <li>Timing belt (if equipped): often has a strict mileage <em>and</em> age limit — missing it can cause major engine damage.</li>
        <li>Timing chain engines usually don’t need scheduled belt changes but can still develop faults; follow symptoms and manual.</li>
        <li>Coolant hoses: soft spots, bulges, or cracks mean replacement.</li>
      </ul>
    </article>

    <article class="guide-article card" id="seasonal">
      <h2>Seasonal checks</h2>
      <ul>
        <li><strong>Before winter:</strong> battery test, antifreeze strength, wipers, lights, and tire suitability (all-season vs winter tires by local law and climate).</li>
        <li><strong>Before summer:</strong> A/C performance, coolant level, tire pressure (heat increases pressure).</li>
        <li>Keep an emergency kit: warning triangle, torch, basic tools, water, and phone charger.</li>
      </ul>
    </article>

    <article class="guide-article card" id="records">
      <h2>Records &amp; mileage</h2>
      <p>
        Logging odometer readings (as in Mecko) helps estimate how quickly you accumulate distance, plan
        oil and tire rotations, and prove service history at resale. Keep receipts and note the date and
        miles for each service.
      </p>
    </article>
  </div>
</template>
