# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`
import logging
from typing import Any

import google.cloud.logging
from firebase_admin import initialize_app
from firebase_functions import https_fn
logger = google.cloud.logging.Client()

initialize_app()

@https_fn.on_call(region="europe-west2")
def on_request_example(req: https_fn.CallableRequest) -> Any:

    # TODO: actually create the doc in firestore here instead of client.
    try:
        document_id = req.data.get("docId")
        destination_blob_name = f"{document_id}.m4a"
        fb_storage_path = req.data.get("fbStoragePath")
    except Exception as e:
        logging.error(e)
        return {"data": "missing docId"}
    return {
        "fbStoragePath": fb_storage_path,
        "docId": document_id,
    }
