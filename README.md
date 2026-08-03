# 🔺 Kobon Triangle Generator & Converter

A web-based interactive generator and visualization tool for **Kobon Triangles**. Ported from an algorithmic random-line generator, this tool constructs line configurations and detects non-overlapping triangles formed by line intersections in real time.

---

## 📌 Features

* **Custom Line Generation:** Specify the number of lines ($n$) along with customizable Y-spread (`b range`) and X-spacing parameters[cite: 1, 3].
* **Real-time Intersection & Triangle Detection:** Calculates line intersections and uses graph analysis to identify valid Kobon triangles[cite: 1, 3].
* **Interactive Canvas Controls:** 
  * 🔍 **Zoom:** Scroll or pinch to zoom in/out[cite: 1, 3].
  * 🖐️ **Pan:** Click and drag to pan across the workspace[cite: 1, 3].
  * 🔄 **Reset View:** Restore the default camera scale with one click[cite: 1, 3].
* **Benchmark Reference Comparison:** Displays maximum known Kobon triangle counts for $n \le 21$ (based on published mathematical research by Clément & Bader, 2007 / Wikipedia)[cite: 1, 3].
* **No Upper Line Limit:** Explore territory beyond published mathematical limits[cite: 1, 3].

---

## 🛠️ Tech Stack

* **HTML5** — UI Layout & Structure[cite: 1]
* **CSS3** — Custom Dark Theme Styling[cite: 4]
* **JavaScript (Vanilla)** — Line generation algorithms, geometric intersection calculations, and dynamic SVG rendering
* **SVG** — Vector graphics for crisp vector rendering during pan & zoom operations[cite: 1, 3, 4]

---

## 🚀 How to Run Locally

Since this is a lightweight frontend application, no build steps or dependencies are required[cite: 1, 3, 4]!

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/DPxRovic/Kobon_Triangle_Converter.git](https://github.com/DPxRovic/Kobon_Triangle_Converter.git)