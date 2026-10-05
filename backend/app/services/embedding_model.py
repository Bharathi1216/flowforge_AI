import logging
import os
import tarfile
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import onnxruntime
from tokenizers import Tokenizer

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / MODEL_NAME
MODEL_FILES = (
    "config.json",
    "model.onnx",
    "special_tokens_map.json",
    "tokenizer_config.json",
    "tokenizer.json",
    "vocab.txt",
)
MODEL_URL = "https://chroma-onnx-models.s3.amazonaws.com/all-MiniLM-L6-v2/onnx.tar.gz"
MODEL_SHA256 = "913d7300ceae3b2dbc2c50d1de4baacab4be7b9380491c27fab7418616a16ec3"


def _model_files_exist() -> bool:
    return all((MODEL_DIR / file_name).exists() for file_name in MODEL_FILES)


def _ensure_model() -> None:
    if _model_files_exist():
        return

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = MODEL_DIR.parent / "onnx.tar.gz"
    if not archive_path.exists():
        logger.info("Downloading %s embedding model", MODEL_NAME)
        with httpx.stream("GET", MODEL_URL, timeout=120) as response:
            response.raise_for_status()
            with archive_path.open("wb") as archive:
                for chunk in response.iter_bytes():
                    archive.write(chunk)

    import hashlib

    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    if digest != MODEL_SHA256:
        archive_path.unlink(missing_ok=True)
        raise RuntimeError("Embedding model checksum verification failed")

    with tarfile.open(archive_path, "r:gz") as archive:
        archive.extractall(MODEL_DIR.parent)
    extracted_dir = MODEL_DIR.parent / "onnx"
    for file_name in MODEL_FILES:
        source = extracted_dir / file_name
        target = MODEL_DIR / file_name
        source.replace(target)
    extracted_dir.rmdir()
    # Keep the verified archive as a local cache so a partially initialized
    # process can resume without downloading the model again.


class EmbeddingModel:
    def __init__(self) -> None:
        _ensure_model()
        self.tokenizer = Tokenizer.from_file(str(MODEL_DIR / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=256)
        self.tokenizer.enable_padding(pad_id=0, pad_token="[PAD]", length=256)
        options = onnxruntime.SessionOptions()
        options.log_severity_level = 3
        options.graph_optimization_level = onnxruntime.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.model = onnxruntime.InferenceSession(
            str(MODEL_DIR / "model.onnx"),
            providers=onnxruntime.get_available_providers(),
            sess_options=options,
        )

    def embed(self, value: str) -> list[float]:
        encoded = self.tokenizer.encode(value)
        input_ids = np.array([encoded.ids], dtype=np.int64)
        attention_mask = np.array([encoded.attention_mask], dtype=np.int64)
        outputs = self.model.run(
            None,
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": np.zeros_like(input_ids),
            },
        )
        hidden_state = outputs[0]
        mask = np.broadcast_to(np.expand_dims(attention_mask, -1), hidden_state.shape)
        embedding = np.sum(hidden_state * mask, axis=1) / np.clip(
            mask.sum(axis=1), a_min=1e-9, a_max=None
        )
        embedding = embedding[0]
        norm = np.linalg.norm(embedding)
        if norm == 0:
            norm = 1e-12
        return [float(value) for value in (embedding / norm)]


embedding_model = EmbeddingModel()
