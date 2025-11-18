import { useState } from 'react';
import PropTypes from 'prop-types';
import { Input, Button, Icon } from '../../atoms';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSearch: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Rechercher...",
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch(value);
  };

  return (
    <form className={styles.searchBar} onSubmit={handleSubmit}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
      <Button type="submit" variant="primary" size="md">
        <Icon name="Search" size="md" />
      </Button>
    </form>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default SearchBar;

