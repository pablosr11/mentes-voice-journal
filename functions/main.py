import json
import logging
from typing import Any

import google.cloud.logging
from firebase_admin import initialize_app
from firebase_functions import https_fn
from google.cloud import firestore, storage
from openai import OpenAI

openai_client = OpenAI()

storage_client = storage.Client()
firestore_client = firestore.Client()
BUCKET_NAME = "mentes-7d592.appspot.com"

logger = google.cloud.logging.Client()
logger.setup_logging()

initialize_app()

prompt = """
You are a helpful assistant for a journalling app. 
Your task is to generate a title, a small summary (less than 3 sentences) and an array of keywords and topics (max 10) about the text.
Users will use this to quickly understand the content of their audio files and to find them later.
The summary should be given as if written by the author directly, extracted from the text. Direct to the point and in the author's voice.
Make sure to use the same language and tone as the original text.
The summary has to be shorter than the text itself. If its not, then rather use 2 or 3 words to describe it.
Always respond as JSON with the keys 'title', 'summary' and 'keywords'. Just respond with json.
"""


def generate_corrected_transcript(temperature, system_prompt, transcript):
    response = openai_client.chat.completions.create(
        model="gpt-3.5-turbo-0125",
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": transcript},
        ],
    )
    return response.choices[0].message.content


@https_fn.on_call(region="europe-west2")
def on_request_example(req: https_fn.CallableRequest) -> Any:

    # TODO: actually create the doc in firestore here instead of client that way client is read-only. and calls apis.
    try:
        document_id = req.data.get("docId")
        destination_blob_name = f"{document_id}.m4a"
        fb_storage_path = req.data.get("blobStoragePath")
    except Exception as e:
        logging.error(e)
        raise https_fn.HttpsError(400, "missing docId or blobStoragePath")

    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        bucket.blob(fb_storage_path).download_to_filename(destination_blob_name)
    except Exception as e:
        logging.error(e)
        raise https_fn.HttpsError(400, "blob download error")

    logging.info("document retrieved")

    try:
        with open(destination_blob_name, "rb") as f:
            transcript_object = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
            )
            transcript = transcript_object.text
            stringified_data = generate_corrected_transcript(0, prompt, transcript)
            data = json.loads(stringified_data)
            logging.info("data: %s", data)
            title = data.get("title")
            summary = data.get("summary")
            keywords = data.get("keywords")

    except Exception as e:
        logging.error(e)
        try:
            doc_ref = firestore_client.collection("voiceNotes").document(document_id)
            doc_ref.update({"status": "ERROR", "updatedAt": firestore.SERVER_TIMESTAMP})
        except Exception as exc:
            logging.error(exc)
        raise https_fn.HttpsError(400, "openai error")

    logging.info("third party data generated")

    try:
        doc_ref = firestore_client.collection("voiceNotes").document(document_id)
        doc_ref.update(
            {
                "data.keywords": keywords,
                "data.title": title,
                "data.summary": summary,
                "data.transcript": transcript,
                "status": "COMPLETE",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
    except Exception as e:
        logging.error(e)
        raise https_fn.HttpsError(400, "firestore error")

    logging.info("process completed")

    return {
        "blobStoragePath": fb_storage_path,
        "docId": document_id,
        "transcript": transcript,
        "title": title,
        "summary": summary,
        "keywords": keywords,
    }
