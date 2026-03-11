from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch


torch.set_num_threads(1)
torch.set_num_interop_threads(1)



app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load model ONCE
MODEL_NAME = "cardiffnlp/tweet-topic-21-multi"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.eval()

EDUCATIONAL_LABELS = {
    "science_&_technology",
    "learning_&_educational"
}


def classify_youtube_video(text):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)

    # Multi-label → sigmoid
    scores = torch.sigmoid(outputs.logits)[0]
    labels = model.config.id2label

    # Find max score label
    max_idx = torch.argmax(scores).item()
    max_label = labels[max_idx]
    max_score = float(scores[max_idx])

    is_educational = max_label in EDUCATIONAL_LABELS

    return 1 if is_educational else 0, max_label, max_score


@app.route("/classify", methods=["POST"])
def classify():
    data = request.json
    text = data.get("text", "")
    print(text)

    label, top_label, confidence = classify_youtube_video(text)

    print(label, top_label, confidence)

    return jsonify({
        "label": label,
        "top_label": top_label,
        "confidence": confidence
    })


if __name__ == "__main__":
    from multiprocessing import freeze_support
    freeze_support()

    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False, threaded=True)
    # app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
