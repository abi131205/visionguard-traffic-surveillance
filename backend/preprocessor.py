import cv2
import numpy as np

class ImagePreprocessor:
    @staticmethod
    def normalize(frame: np.ndarray) -> np.ndarray:
        """
        Resize to 640x640, convert BGR to RGB, normalize pixel values to [0, 1].
        """
        resized = cv2.resize(frame, (640, 640))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = rgb.astype(np.float32) / 255.0
        return normalized

    @staticmethod
    def enhance_low_light(frame: np.ndarray) -> np.ndarray:
        """
        Convert to LAB color space, apply CLAHE to the L channel, convert back to BGR.
        """
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

    @staticmethod
    def reduce_motion_blur(frame: np.ndarray) -> np.ndarray:
        """
        Apply unsharp masking to sharpen motion blur.
        """
        blurred = cv2.GaussianBlur(frame, (0, 0), 3)
        sharpened = cv2.addWeighted(frame, 1.5, blurred, -0.5, 0)
        return sharpened

    @staticmethod
    def remove_rain_artifacts(frame: np.ndarray) -> np.ndarray:
        """
        Apply median blur to reduce rain streak noise.
        """
        return cv2.medianBlur(frame, 3)

    @staticmethod
    def correct_shadows(frame: np.ndarray) -> np.ndarray:
        """
        Convert to HSV, normalize V channel using morphological top-hat & black-hat
        to correct for shadow and illumination variance.
        """
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        # Top-hat to isolate bright spots, black-hat to isolate shadows
        tophat = cv2.morphologyEx(v, cv2.MORPH_TOPHAT, kernel)
        blackhat = cv2.morphologyEx(v, cv2.MORPH_BLACKHAT, kernel)
        # Correct illumination
        v_corrected = cv2.add(cv2.subtract(v, blackhat), tophat)
        hsv_corrected = cv2.merge((h, s, v_corrected))
        return cv2.cvtColor(hsv_corrected, cv2.COLOR_HSV2BGR)

    @classmethod
    def auto_preprocess(cls, frame: np.ndarray) -> tuple[np.ndarray, dict]:
        """
        Automatically check image conditions (low light, motion blur, rain, shadows)
        and apply appropriate enhancements. Returns the preprocessed BGR frame and log of enhancements.
        """
        enhanced_frame = frame.copy()
        applied = []

        # 1. Check Low Light: mean brightness on YUV or Grayscale
        gray = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = np.mean(gray)
        if mean_brightness < 80:
            enhanced_frame = cls.enhance_low_light(enhanced_frame)
            applied.append("Low Light Enhancement (CLAHE)")

        # Recompute grayscale for subsequent heuristics
        gray = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2GRAY)

        # 2. Check Motion Blur: Laplacian variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 100:
            enhanced_frame = cls.reduce_motion_blur(enhanced_frame)
            applied.append("Motion Blur Reduction (Unsharp Mask)")

        # 3. Check Rain: Sobel vertical vs horizontal structure ratio heuristic
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3).var()
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3).var()
        # Rain streaks are vertical, leading to much higher vertical gradients than horizontal ones
        if sobel_x > 0 and (sobel_y / sobel_x) > 1.3:
            enhanced_frame = cls.remove_rain_artifacts(enhanced_frame)
            applied.append("Rain Artifact Filter (Median Blur)")

        # 4. Correct Shadows (apply generally if illumination variance is high)
        # Check standard deviation of V channel
        hsv = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2HSV)
        v = hsv[:, :, 2]
        std_v = np.std(v)
        if std_v > 50:
            enhanced_frame = cls.correct_shadows(enhanced_frame)
            applied.append("Shadow Correction (Morphological Top-Hat)")

        return enhanced_frame, {"applied_enhancements": applied}
