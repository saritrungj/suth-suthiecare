# -*- coding: utf-8 -*-
"""Turn a SUTHieCare FAQ export into SQL for the SUTH Operator knowledge base.

Usage:  python to_operator_sql.py [suthiecare_faq_full.sql]
Output: suth_operator_knowledge_suthiecare_faq.sql

Ids are UUIDv5 derived from the FAQ source, so re-running the SQL updates the same
rows instead of duplicating them. After importing, call POST /api/knowledge/re-embed
so ChromaDB picks up the new documents.
"""
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

import build_kb

HERE = Path(__file__).resolve().parent
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "suthiecare-faq")
OLD_PCU_DOCUMENT_ID = "97e7b7ea-6668-41fe-988c-df9b3f6e4c28"


def sql_str(value):
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'"


def doc_key(doc):
    meta = doc["metadata"]
    return f"faq:{meta['sourceId']}" if meta.get("sourceTable") == "faqs" else f"manual:{doc['title']}"


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "suthiecare_faq_full.sql"
    rows = build_kb.load_rows(src)
    docs = build_kb.build_manual_docs(src.name) + build_kb.build_faq_docs(rows, src.name)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S.000")

    out = [
        f"-- SUTH Operator knowledge documents generated from {src.name}",
        f"-- {len(docs)} documents. Safe to re-run: rows are keyed by deterministic UUIDs.",
        "-- After import: POST /api/knowledge/re-embed to push the documents into ChromaDB.",
        "SET NAMES utf8mb4;",
        "START TRANSACTION;",
        "",
    ]
    for doc in docs:
        key = doc_key(doc)
        doc_id = str(uuid.uuid5(NAMESPACE, key))
        vector_id = str(uuid.uuid5(NAMESPACE, "vector:" + key))
        metadata = json.dumps(doc["metadata"], ensure_ascii=False)
        out.append(f"-- {doc['title']}")
        out.append(
            "INSERT INTO `knowledge_documents` "
            "(`id`, `title`, `content`, `vectorId`, `metadata`, `isActive`, `createdAt`, `updatedAt`, `keywords`) VALUES ("
            f"{sql_str(doc_id)}, {sql_str(doc['title'])}, {sql_str(doc['content'])}, {sql_str(vector_id)}, "
            f"{sql_str(metadata)}, 1, {sql_str(now)}, {sql_str(now)}, {sql_str(doc['keywords'])}) "
            "ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `content` = VALUES(`content`), "
            "`metadata` = VALUES(`metadata`), `keywords` = VALUES(`keywords`), `updatedAt` = VALUES(`updatedAt`);"
        )
        out.append(
            "INSERT INTO `knowledge_document_classification` (`document_id`, `category_id`, `updated_at`) VALUES ("
            f"{sql_str(doc_id)}, {sql_str(doc['categoryId'])}, {sql_str(now)}) "
            "ON DUPLICATE KEY UPDATE `category_id` = VALUES(`category_id`), `updated_at` = VALUES(`updated_at`);"
        )
        out.append("")
    out += [
        "-- The existing PCU SUTH document overlaps the two new PCU schedule documents.",
        "-- Uncomment to retire it so RAG does not return both.",
        f"-- UPDATE `knowledge_documents` SET `isActive` = 0 WHERE `id` = '{OLD_PCU_DOCUMENT_ID}';",
        "",
        "COMMIT;",
        "",
    ]
    target = HERE / "suth_operator_knowledge_suthiecare_faq.sql"
    target.write_text("\n".join(out), encoding="utf-8")
    print(f"{len(docs)} documents -> {target.name}")


if __name__ == "__main__":
    main()
