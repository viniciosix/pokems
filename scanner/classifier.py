from transformers import pipeline

class PokemonClassifier:
    def __init__(self, model, threshold=0.70):
        self.threshold = threshold
        self.pipe = pipeline('image-classification', model=model, top_k=3, device=-1)

    def classify(self, image):
        preds = self.pipe(image)
        if not preds:
            return None
        p = preds[0]
        label = str(p['label']).replace('_', ' ').strip()
        score = float(p['score'])
        if score >= self.threshold:
            return {'species': label, 'confidence': score}
        return {'species': None, 'confidence': score, 'candidate': label}
