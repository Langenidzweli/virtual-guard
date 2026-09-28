import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from app.vision.model_cache import get_model, _load

class ModelCacheTests(unittest.TestCase):
    def setUp(self):
        _load.cache_clear()
    def tearDown(self):
        _load.cache_clear()
    def test_reuses_models_and_locks_under_concurrent_load(self):
        with tempfile.TemporaryDirectory() as folder, patch('ultralytics.YOLO') as factory:
            path=Path(folder)/'model.pt'; path.write_bytes(b'weights')
            with ThreadPoolExecutor(max_workers=4) as pool:
                results=list(pool.map(lambda _:get_model(path),range(8)))
            self.assertEqual(factory.call_count,1)
            for result in results: self.assertIs(result,results[0])
    def test_reloads_replaced_weights_and_separates_tasks(self):
        with tempfile.TemporaryDirectory() as folder, patch('ultralytics.YOLO') as factory:
            path=Path(folder)/'model.pt'; path.write_bytes(b'old')
            get_model(path);get_model(path,task='pose')
            path.write_bytes(b'new weights')
            get_model(path)
            self.assertEqual(factory.call_count,3)
    def test_missing_weights_fail(self):
        with self.assertRaises(FileNotFoundError): get_model('/no-such-model.pt')
