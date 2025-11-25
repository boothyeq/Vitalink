# FILE: backend/digit_recognition_backend.py

import sys
import json
import cv2
import imutils
from imutils import contours
import os
import numpy as np
import base64
from roboflow import Roboflow
import dotenv

dotenv.load_dotenv()

# --- 7-segment recognition lookup table ---
DIGITS_LOOKUP = {
    (1, 1, 1, 0, 1, 1, 1): 0,
    (0, 0, 1, 0, 0, 1, 0): 1,
    (1, 0, 1, 1, 1, 1, 0): 2,
    (1, 0, 1, 1, 0, 1, 1): 3,
    (0, 1, 1, 1, 0, 1, 0): 4,
    (1, 1, 0, 1, 0, 1, 1): 5,
    (1, 1, 0, 1, 1, 1, 1): 6,
    (1, 0, 1, 0, 0, 1, 0): 7,
    (1, 1, 1, 0, 0, 1, 0): 7,
    (1, 1, 1, 1, 1, 1, 1): 8,
    (1, 1, 1, 1, 0, 1, 1): 9
}

def process_image(image_path):
    try:
        # --- Roboflow automatic detection ---
        rf = Roboflow(api_key=os.environ.get("ROBOFLOW_API_KEY"))
        project = rf.workspace().project(os.environ.get("ROBOFLOW_PROJECT_ID"))
        model = project.version(int(os.environ.get("ROBOFLOW_VERSION_NUMBER"))).model
        prediction = model.predict(image_path, confidence=40, overlap=30).json()

        if not prediction['predictions']:
            print(json.dumps({"error": "Roboflow model could not detect a screen."}))
            return

        best = max(prediction['predictions'], key=lambda p: p['confidence'])
        orig_crop_x = int(best['x'] - best['width'] / 2)
        orig_crop_y = int(best['y'] - best['height'] / 2)
        orig_crop_w = int(best['width'])
        orig_crop_h = int(best['height'])

        # --- Load full image and resize ---
        full = cv2.imread(image_path)
        if full is None:
            print(json.dumps({"error": "Could not load image"}))
            return

        (orig_h, orig_w) = full.shape[:2]
        resized = imutils.resize(full, height=500)
        (resized_h, resized_w) = resized.shape[:2]
        ratio = resized_h / float(orig_h)

        # Scale the Roboflow coordinates
        x = int(orig_crop_x * ratio)
        y = int(orig_crop_y * ratio)
        w = int(orig_crop_w * ratio)
        h = int(orig_crop_h * ratio)

        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        roi_gray = gray[y:y+h, x:x+w]

        # --- FINAL, ROBUST PREPROCESSING PIPELINE ---
        # 1. Enhance Contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(roi_gray)
        
        # 2. **CRITICAL FIX**: Add a gentle blur to smooth noise AFTER enhancement
        blurred = cv2.medianBlur(enhanced, 3)

        # 3. Threshold the blurred and enhanced image
        thresh = cv2.adaptiveThreshold(blurred, 255,
                                       cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY_INV, 21, 10)

        # 4. **CRITICAL FIX**: Use a slightly stronger Closing kernel to heal breaks
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (4, 4))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        # --- Find digit contours ---
        cnts = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = imutils.grab_contours(cnts)
        digitCnts = []
        for c in cnts:
            bx, by, bw, bh = cv2.boundingRect(c)
            if bh > 20 and (bw/float(bh) > 0.1 and bw/float(bh) < 1.0):
                digitCnts.append(c)

        if not digitCnts:
            print(json.dumps({"error": "No valid digit contours found"}))
            return

        (digitCnts, boxes) = contours.sort_contours(digitCnts, method="top-to-bottom")

        # --- Group digits into lines ---
        groups = []
        current = []
        if not boxes:
            print(json.dumps({"error": "Sorting contours failed."}))
            return
        base_y = boxes[0][1]

        for (c, (bx, by, bw, bh)) in zip(digitCnts, boxes):
            if by < base_y + bh:
                current.append((c, (bx, by, bw, bh)))
            else:
                current.sort(key=lambda it: it[1][0])
                groups.append(current)
                current = [(c, (bx, by, bw, bh))]
                base_y = by

        current.sort(key=lambda it: it[1][0])
        groups.append(current)

        # --- Recognize digits and annotate ---
        out = resized.copy()
        readings = []

        for line in groups:
            line_digits = ""
            for (c, (bx, by, bw, bh)) in line:
                roi = thresh[by:by+bh, bx:bx+bw]
                aspect = bw / float(bh)
                digit = None

                if aspect < 0.4:
                    digit = 1
                else:
                    on = [0]*7
                    (roiH, roiW) = roi.shape
                    (dW, dH) = (int(roiW*0.25), int(roiH*0.15))
                    dHC = int(roiH * 0.05)
                    segments = [
                        ((0, 0), (bw, dH)), ((0, 0), (dW, bh//2)), ((bw - dW, 0), (bw, bh//2)),
                        ((0, (bh//2)-dHC), (bw, (bh//2)+dHC)), ((0, bh//2), (dW, bh)),
                        ((bw - dW, bh//2), (bw, bh)), ((0, bh-dH), (bw, bh))
                    ]
                    for i, ((xA, yA), (xB, yB)) in enumerate(segments):
                        seg = roi[yA:yB, xA:xB]
                        if seg.size == 0: continue
                        total = cv2.countNonZero(seg)
                        area = seg.shape[0]*seg.shape[1]
                        if area > 0 and total/area > 0.45: on[i] = 1
                    try: digit = DIGITS_LOOKUP[tuple(on)]
                    except: digit = None

                if digit is not None:
                    line_digits += str(digit)
                    # Draw on the full resized image with the proper offset
                    cv2.rectangle(out, (bx+x, by+y), (bx+x+bw, by+y+bh), (0,255,0), 2)
                    cv2.putText(out, str(digit), (bx+x-10, by+y-10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0,255,0), 2)

            readings.append(line_digits)

        # --- Encode annotated image ---
        _, buf = cv2.imencode('.jpg', out)
        encoded = base64.b64encode(buf).decode('utf-8')

        print(json.dumps({
            "sys": readings[0] if len(readings)>0 else "",
            "dia": readings[1] if len(readings)>1 else "",
            "pulse": readings[2] if len(readings)>2 else "",
            "annotatedImage": encoded
        }))

    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e) + "\n" + traceback.format_exc()}))


# --- MAIN ENTRY POINT ---
if __name__ == "__main__":
    if len(sys.argv) == 2:
        image_path = sys.argv[1]
        process_image(image_path)
    else:
        print(json.dumps({"error": "Incorrect number of arguments passed to Python script."}))
