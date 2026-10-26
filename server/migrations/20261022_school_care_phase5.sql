-- Phase 5 of school care: uploaded document files are kept in the database,
-- like the result-page images, so they need no shared disk. Rerunnable.
CREATE TABLE IF NOT EXISTS school_document_files (
 document_id INT NOT NULL PRIMARY KEY,
 file_name VARCHAR(200) NOT NULL,
 content LONGBLOB NOT NULL,
 FOREIGN KEY(document_id) REFERENCES school_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
